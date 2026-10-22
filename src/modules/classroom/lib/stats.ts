// Classroom statistics for the admin dashboards. Everything is read from what students already leave behind
// (enrolments, progress, comments, block state), so there is no tracking beacon and nothing extra is stored.
// "Learners" are students only: staff opening a lesson never count. Days are UTC.
import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db/use";
import { pollCounts } from "./learn";

export const DAY_CHOICES = [7, 30, 90] as const;
export const cleanDays = (v: unknown) => ((DAY_CHOICES as readonly number[]).includes(Number(v)) ? Number(v) : 30);

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v) || 0;

export type Timeline = { labels: string[]; enrolments: number[]; completions: number[]; learners: number[] };

async function timeline(days: number, courseId?: number): Promise<Timeline> {
  const e = courseId ? sql`AND e.course_id = ${courseId}` : sql``;
  const p = courseId ? sql`AND p.course_id = ${courseId}` : sql``;
  const res = await db().execute(sql`
    WITH days AS (SELECT generate_series((current_date - (${days - 1}::int)), current_date, interval '1 day')::date AS d)
    SELECT d::text AS day,
      (SELECT COUNT(*) FROM classroom_enrolments e WHERE e.created_at::date = d ${e})::int AS enrolments,
      (SELECT COUNT(*) FROM classroom_progress p JOIN users u ON u.id = p.user_id AND u.role = 'student' WHERE p.completed_at::date = d ${p})::int AS completions,
      (SELECT COUNT(DISTINCT p.user_id) FROM classroom_progress p JOIN users u ON u.id = p.user_id AND u.role = 'student' WHERE p.updated_at::date = d ${p})::int AS learners
    FROM days ORDER BY d`);
  const rows = rowsOf<Row>(res);
  return { labels: rows.map((r) => String(r.day)), enrolments: rows.map((r) => num(r.enrolments)), completions: rows.map((r) => num(r.completions)), learners: rows.map((r) => num(r.learners)) };
}

/** Money by currency, from enrolments an admin marked as paid. */
async function revenue(days: number, courseId?: number): Promise<{ currency: string; total: number; period: number }[]> {
  const c = courseId ? sql`AND course_id = ${courseId}` : sql``;
  const res = await db().execute(sql`
    SELECT currency, COALESCE(SUM(amount_cents), 0)::bigint AS total,
      COALESCE(SUM(amount_cents) FILTER (WHERE paid_at >= now() - (${days}::int * interval '1 day')), 0)::bigint AS period
    FROM classroom_enrolments WHERE paid_at IS NOT NULL AND amount_cents > 0 ${c} GROUP BY currency ORDER BY currency`);
  return rowsOf<Row>(res).map((r) => ({ currency: String(r.currency), total: num(r.total) / 100, period: num(r.period) / 100 }));
}

export type CourseRow = { id: number; title: string; status: string; lessons: number; students: number; pending: number; active: number; avgProgress: number | null; finished: number; revenue: { currency: string; total: number }[] };

/** Per course: students, who is active, how far they got, who finished. */
async function courseRows(days: number): Promise<CourseRow[]> {
  const [cs, prog, rev] = await Promise.all([
    db().execute(sql`
      SELECT c.id, c.title, c.status,
        (SELECT COUNT(*) FROM classroom_lessons l WHERE l.course_id = c.id AND l.status = 'active')::int AS lessons,
        (SELECT COUNT(*) FROM classroom_enrolments e WHERE e.course_id = c.id AND e.status = 'active')::int AS students,
        (SELECT COUNT(*) FROM classroom_enrolments e WHERE e.course_id = c.id AND e.status = 'pending')::int AS pending,
        (SELECT COUNT(DISTINCT p.user_id) FROM classroom_progress p JOIN users u ON u.id = p.user_id AND u.role = 'student' WHERE p.course_id = c.id AND p.updated_at >= now() - (${days}::int * interval '1 day'))::int AS active
      FROM classroom_courses c WHERE c.status <> 'archived' ORDER BY c.updated_at DESC`),
    db().execute(sql`
      SELECT e.course_id,
        (SELECT COUNT(*) FROM classroom_progress p JOIN classroom_lessons l ON l.id = p.lesson_id AND l.status = 'active' WHERE p.user_id = e.user_id AND p.course_id = e.course_id AND p.completed_at IS NOT NULL)::int AS done
      FROM classroom_enrolments e WHERE e.status = 'active'`),
    db().execute(sql`SELECT course_id, currency, SUM(amount_cents)::bigint AS total FROM classroom_enrolments WHERE paid_at IS NOT NULL AND amount_cents > 0 GROUP BY course_id, currency`),
  ]);
  const doneBy = new Map<number, number[]>();
  for (const r of rowsOf<Row>(prog)) doneBy.set(num(r.course_id), [...(doneBy.get(num(r.course_id)) ?? []), num(r.done)]);
  const revBy = new Map<number, { currency: string; total: number }[]>();
  for (const r of rowsOf<Row>(rev)) revBy.set(num(r.course_id), [...(revBy.get(num(r.course_id)) ?? []), { currency: String(r.currency), total: num(r.total) / 100 }]);
  return rowsOf<Row>(cs).map((r) => {
    const lessons = num(r.lessons);
    const done = doneBy.get(num(r.id)) ?? [];
    return {
      id: num(r.id),
      title: String(r.title),
      status: String(r.status),
      lessons,
      students: num(r.students),
      pending: num(r.pending),
      active: num(r.active),
      avgProgress: lessons && done.length ? Math.round((done.reduce((t, d) => t + Math.min(d, lessons) / lessons, 0) / done.length) * 100) : null,
      finished: lessons ? done.filter((d) => d >= lessons).length : 0,
      revenue: revBy.get(num(r.id)) ?? [],
    };
  });
}

export type LibraryStats = {
  days: number;
  cards: { courses: number; activeCourses: number; lessons: number; students: number; pending: number; newEnrolments: number; activeLearners: number; completions: number; openQuestions: number };
  revenue: { currency: string; total: number; period: number }[];
  timeline: Timeline;
  courses: CourseRow[];
};

export async function libraryStats(daysIn: unknown): Promise<LibraryStats> {
  const days = cleanDays(daysIn);
  const [c, tl, rev, courses] = await Promise.all([
    db().execute(sql`
      SELECT
        (SELECT COUNT(*) FROM classroom_courses WHERE status <> 'archived')::int AS courses,
        (SELECT COUNT(*) FROM classroom_courses WHERE status = 'active')::int AS active_courses,
        (SELECT COUNT(*) FROM classroom_lessons l JOIN classroom_courses k ON k.id = l.course_id WHERE l.status = 'active' AND k.status = 'active')::int AS lessons,
        (SELECT COUNT(DISTINCT user_id) FROM classroom_enrolments WHERE status = 'active')::int AS students,
        (SELECT COUNT(*) FROM classroom_enrolments WHERE status = 'pending')::int AS pending,
        (SELECT COUNT(*) FROM classroom_enrolments WHERE created_at >= now() - (${days}::int * interval '1 day'))::int AS new_enrolments,
        (SELECT COUNT(DISTINCT p.user_id) FROM classroom_progress p JOIN users u ON u.id = p.user_id AND u.role = 'student' WHERE p.updated_at >= now() - (${days}::int * interval '1 day'))::int AS active_learners,
        (SELECT COUNT(*) FROM classroom_progress p JOIN users u ON u.id = p.user_id AND u.role = 'student' WHERE p.completed_at >= now() - (${days}::int * interval '1 day'))::int AS completions,
        (SELECT COUNT(*) FROM classroom_comments c WHERE c.parent_id IS NULL AND NOT c.resolved AND c.status = 'visible'
           AND NOT EXISTS (SELECT 1 FROM classroom_comments r JOIN users ru ON ru.id = r.user_id WHERE r.parent_id = c.id AND ru.role <> 'student'))::int AS open_questions`),
    timeline(days),
    revenue(days),
    courseRows(days),
  ]);
  const r = rowsOf<Row>(c)[0] ?? {};
  return {
    days,
    cards: { courses: num(r.courses), activeCourses: num(r.active_courses), lessons: num(r.lessons), students: num(r.students), pending: num(r.pending), newEnrolments: num(r.new_enrolments), activeLearners: num(r.active_learners), completions: num(r.completions), openQuestions: num(r.open_questions) },
    revenue: rev,
    timeline: tl,
    courses,
  };
}

export type LessonFunnelRow = { id: number; title: string; module: string; started: number; completed: number; comments: number };
export type PollRow = { blockId: number; lesson: string; question: string; options: string[]; counts: number[] };

export type CourseStats = {
  days: number;
  course: { id: number; title: string; status: string; lessons: number };
  cards: { students: number; pending: number; revoked: number; newEnrolments: number; activeLearners: number; avgProgress: number | null; finished: number; completionRate: number | null; comments: number; openQuestions: number; sharedAnswers: number };
  revenue: { currency: string; total: number; period: number }[];
  timeline: Timeline;
  funnel: LessonFunnelRow[];
  polls: PollRow[];
};

export async function courseStats(courseId: number, daysIn: unknown): Promise<CourseStats | null> {
  const days = cleanDays(daysIn);
  const library = await courseRows(days);
  const row = library.find((c) => c.id === courseId);
  if (!row) {
    const [c] = rowsOf<Row>(await db().execute(sql`SELECT id, title, status FROM classroom_courses WHERE id = ${courseId}`));
    if (!c) return null;
    library.push({ id: courseId, title: String(c.title), status: String(c.status), lessons: 0, students: 0, pending: 0, active: 0, avgProgress: null, finished: 0, revenue: [] }); // an archived course still has numbers
  }
  const course = library.find((c) => c.id === courseId) as CourseRow;
  const [counts, tl, rev, funnelRes, pollRes] = await Promise.all([
    db().execute(sql`
      SELECT
        (SELECT COUNT(*) FROM classroom_enrolments WHERE course_id = ${courseId} AND status = 'revoked')::int AS revoked,
        (SELECT COUNT(*) FROM classroom_enrolments WHERE course_id = ${courseId} AND created_at >= now() - (${days}::int * interval '1 day'))::int AS new_enrolments,
        (SELECT COUNT(*) FROM classroom_comments WHERE course_id = ${courseId})::int AS comments,
        (SELECT COUNT(*) FROM classroom_comments c WHERE c.course_id = ${courseId} AND c.parent_id IS NULL AND NOT c.resolved AND c.status = 'visible'
           AND NOT EXISTS (SELECT 1 FROM classroom_comments r JOIN users ru ON ru.id = r.user_id WHERE r.parent_id = c.id AND ru.role <> 'student'))::int AS open_questions,
        (SELECT COUNT(*) FROM classroom_block_state s JOIN classroom_blocks b ON b.id = s.block_id JOIN classroom_lessons l ON l.id = s.lesson_id
           WHERE l.course_id = ${courseId} AND b.type = 'question' AND COALESCE(s.data ->> 'answer', '') <> '')::int AS shared_answers`),
    timeline(days, courseId),
    revenue(days, courseId),
    db().execute(sql`
      SELECT l.id, l.title, m.title AS module,
        (SELECT COUNT(*) FROM classroom_progress p JOIN users u ON u.id = p.user_id AND u.role = 'student' WHERE p.lesson_id = l.id)::int AS started,
        (SELECT COUNT(*) FROM classroom_progress p JOIN users u ON u.id = p.user_id AND u.role = 'student' WHERE p.lesson_id = l.id AND p.completed_at IS NOT NULL)::int AS completed,
        (SELECT COUNT(*) FROM classroom_comments c WHERE c.lesson_id = l.id)::int AS comments
      FROM classroom_lessons l JOIN classroom_modules m ON m.id = l.module_id
      WHERE l.course_id = ${courseId} AND l.status = 'active' ORDER BY m.position, l.position`),
    db().execute(sql`
      SELECT b.id, b.settings, l.title AS lesson FROM classroom_blocks b JOIN classroom_lessons l ON l.id = b.lesson_id
      WHERE l.course_id = ${courseId} AND b.type = 'poll' ORDER BY l.position, b.position`),
  ]);
  const k = rowsOf<Row>(counts)[0] ?? {};
  const polls = rowsOf<{ id: number; settings: { question?: string; options?: string[] }; lesson: string }>(pollRes);
  const pollData = await pollCounts(polls.map((p) => ({ id: num(p.id), options: Math.min(8, (p.settings?.options ?? []).length) })));
  return {
    days,
    course: { id: course.id, title: course.title, status: course.status, lessons: course.lessons },
    cards: {
      students: course.students,
      pending: course.pending,
      revoked: num(k.revoked),
      newEnrolments: num(k.new_enrolments),
      activeLearners: course.active,
      avgProgress: course.avgProgress,
      finished: course.finished,
      completionRate: course.students ? Math.round((course.finished / course.students) * 100) : null,
      comments: num(k.comments),
      openQuestions: num(k.open_questions),
      sharedAnswers: num(k.shared_answers),
    },
    revenue: rev,
    timeline: tl,
    funnel: rowsOf<Row>(funnelRes).map((r) => ({ id: num(r.id), title: String(r.title), module: String(r.module), started: num(r.started), completed: num(r.completed), comments: num(r.comments) })),
    polls: polls.map((p) => ({ blockId: num(p.id), lesson: String(p.lesson), question: String(p.settings?.question ?? ""), options: (p.settings?.options ?? []).slice(0, 8), counts: pollData[num(p.id)] ?? [] })),
  };
}
