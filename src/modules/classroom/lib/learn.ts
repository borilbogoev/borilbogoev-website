// What a student leaves behind: progress, private notes, questions and comments, and the state of interactive blocks.
import { and, eq, or, sql } from "drizzle-orm";
import { schema } from "@/db";
import { db, rowsOf } from "@/db/use";
import { cleanMultiline } from "@/modules/forms/lib/sanitize";
import { isInteractive, type BlockType } from "./blocks";

const { classroomProgress: progress, classroomNotes: notes, classroomComments: comments, classroomBlockState: blockState, classroomBlocks: blocks } = schema;

/* -------------------------------------------------------------------------- */
/* Progress                                                                   */
/* -------------------------------------------------------------------------- */

export type CourseState = { completed: number[]; lastLessonId: number | null };

export async function courseState(userId: string, courseId: number): Promise<CourseState> {
  const rows = await db().select().from(progress).where(and(eq(progress.userId, userId), eq(progress.courseId, courseId)));
  const last = [...rows].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  return { completed: rows.filter((r) => r.completedAt).map((r) => r.lessonId), lastLessonId: last?.lessonId ?? null };
}

/** Marks a lesson done or not done. Opening a lesson also records it as the one to resume (done = undefined). */
export async function markLesson(userId: string, lessonId: number, courseId: number, done?: boolean): Promise<void> {
  const now = new Date();
  const completedAt = done === true ? now : done === false ? null : undefined;
  await db()
    .insert(progress)
    .values({ userId, lessonId, courseId, completedAt: completedAt ?? null, updatedAt: now })
    .onConflictDoUpdate({ target: [progress.userId, progress.lessonId], set: { updatedAt: now, ...(completedAt !== undefined ? { completedAt } : {}) } });
}

/* -------------------------------------------------------------------------- */
/* Notes                                                                      */
/* -------------------------------------------------------------------------- */

export const MAX_NOTE = 20000;

export async function getNote(userId: string, lessonId: number): Promise<{ body: string; updatedAt: string | null }> {
  const [r] = await db().select().from(notes).where(and(eq(notes.userId, userId), eq(notes.lessonId, lessonId))).limit(1);
  return { body: r?.body ?? "", updatedAt: r?.updatedAt.toISOString() ?? null };
}

export async function saveNote(userId: string, lessonId: number, body: unknown): Promise<string> {
  const text = cleanMultiline(body, MAX_NOTE);
  const now = new Date();
  await db().insert(notes).values({ userId, lessonId, body: text, updatedAt: now }).onConflictDoUpdate({ target: [notes.userId, notes.lessonId], set: { body: text, updatedAt: now } });
  return now.toISOString();
}

/** All notes of a student in a course, in lesson order, for export. */
export async function courseNotes(userId: string, courseId: number): Promise<{ lessonId: number; title: string; module: string; body: string }[]> {
  const res = await db().execute(sql`
    SELECT n.lesson_id, l.title, m.title AS module, n.body
    FROM classroom_notes n JOIN classroom_lessons l ON l.id = n.lesson_id JOIN classroom_modules m ON m.id = l.module_id
    WHERE n.user_id = ${userId} AND l.course_id = ${courseId} AND n.body <> ''
    ORDER BY m.position, l.position`);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({ lessonId: Number(r.lesson_id), title: String(r.title), module: String(r.module), body: String(r.body) }));
}

/* -------------------------------------------------------------------------- */
/* Comments and questions                                                     */
/* -------------------------------------------------------------------------- */

export type CommentView = {
  id: number;
  parentId: number | null;
  body: string;
  visibility: "class" | "instructor";
  hidden: boolean;
  resolved: boolean;
  pinned: boolean;
  author: string;
  staff: boolean;
  mine: boolean;
  createdAt: string;
  editedAt: string | null;
};

export const MAX_COMMENT = 4000;

type Viewer = { id: string; moderator: boolean };

/**
 * The thread of a lesson as `viewer` may read it. Everyone reads the class comments; an instructor-only question is read by
 * its author, the replies to it, and the staff. Moderators also see hidden comments. Other students' emails are never sent.
 */
export async function listComments(lessonId: number, viewer: Viewer): Promise<CommentView[]> {
  const res = await db().execute(sql`
    SELECT c.id, c.parent_id, c.body, c.visibility, c.status, c.resolved, c.pinned, c.user_id, c.created_at, c.edited_at,
      u.name AS author_name, u.role AS author_role
    FROM classroom_comments c JOIN users u ON u.id = c.user_id
    WHERE c.lesson_id = ${lessonId}
    ORDER BY c.pinned DESC, c.created_at ASC
    LIMIT 500`);
  const rows = rowsOf<Record<string, unknown>>(res);
  const byId = new Map(rows.map((r) => [Number(r.id), r]));
  const root = (r: Record<string, unknown>) => (r.parent_id ? byId.get(Number(r.parent_id)) ?? r : r);
  const out: CommentView[] = [];
  for (const r of rows) {
    const top = root(r);
    const mine = String(r.user_id) === viewer.id;
    const hidden = r.status === "hidden" || top.status === "hidden";
    if (hidden && !viewer.moderator) continue;
    // An instructor-only thread belongs to its author and the staff.
    if (top.visibility === "instructor" && !viewer.moderator && String(top.user_id) !== viewer.id) continue;
    const role = String(r.author_role);
    const staff = role !== "student";
    out.push({
      id: Number(r.id),
      parentId: r.parent_id === null ? null : Number(r.parent_id),
      body: String(r.body),
      visibility: top.visibility === "instructor" ? "instructor" : "class",
      hidden,
      resolved: !!r.resolved,
      pinned: !!r.pinned,
      author: staff ? String(r.author_name || "Instructor") : String(r.author_name || "Student"),
      staff,
      mine,
      createdAt: new Date(r.created_at as string).toISOString(),
      editedAt: r.edited_at ? new Date(r.edited_at as string).toISOString() : null,
    });
  }
  return out;
}

const recent = new Map<string, number[]>();

/** At most 8 comments a minute per person: a brake on spam, not a hard limit (it lives in one server instance). */
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const list = (recent.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= 8) return true;
  list.push(now);
  recent.set(userId, list);
  if (recent.size > 2000) for (const [k, v] of recent) if (!v.some((t) => now - t < 60_000)) recent.delete(k);
  return false;
}

export async function addComment(input: { lessonId: number; courseId: number; userId: string; body: unknown; visibility?: string; parentId?: number | null }): Promise<{ ok: true; id: number } | { ok: false; error: string; status: number }> {
  const body = cleanMultiline(input.body, MAX_COMMENT).trim();
  if (!body) return { ok: false, error: "Write something first.", status: 400 };
  if (rateLimited(input.userId)) return { ok: false, error: "You are posting very fast. Wait a moment.", status: 429 };
  let visibility: "class" | "instructor" = input.visibility === "instructor" ? "instructor" : "class";
  let parentId: number | null = null;
  if (input.parentId) {
    const [p] = await db().select().from(comments).where(eq(comments.id, Number(input.parentId))).limit(1);
    if (!p || p.lessonId !== input.lessonId) return { ok: false, error: "The comment you are answering is gone.", status: 404 };
    parentId = p.parentId ?? p.id; // one level of replies
    const [top] = p.parentId ? await db().select().from(comments).where(eq(comments.id, p.parentId)).limit(1) : [p];
    visibility = top?.visibility === "instructor" ? "instructor" : "class"; // a reply stays as private as the question it answers
  }
  const [row] = await db().insert(comments).values({ lessonId: input.lessonId, courseId: input.courseId, userId: input.userId, parentId, body, visibility }).returning({ id: comments.id });
  return { ok: true, id: row.id };
}

export type CommentPatch = { body?: string; visibility?: string; hidden?: boolean; resolved?: boolean; pinned?: boolean };

/** The author may edit the text and the visibility; a moderator may also hide, resolve and pin. */
export async function updateComment(id: number, viewer: Viewer, patch: CommentPatch): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const [c] = await db().select().from(comments).where(eq(comments.id, id)).limit(1);
  if (!c) return { ok: false, error: "Comment not found.", status: 404 };
  const author = c.userId === viewer.id;
  if (!author && !viewer.moderator) return { ok: false, error: "Not allowed.", status: 403 };
  const set: Partial<typeof comments.$inferInsert> = {};
  if (patch.body !== undefined && author) {
    const body = cleanMultiline(patch.body, MAX_COMMENT).trim();
    if (!body) return { ok: false, error: "A comment cannot be empty.", status: 400 };
    set.body = body;
    set.editedAt = new Date();
  }
  if (patch.visibility !== undefined && !c.parentId) set.visibility = patch.visibility === "instructor" ? "instructor" : "class";
  if (viewer.moderator) {
    if (patch.hidden !== undefined) set.status = patch.hidden ? "hidden" : "visible";
    if (patch.resolved !== undefined) set.resolved = !!patch.resolved;
    if (patch.pinned !== undefined && !c.parentId) set.pinned = !!patch.pinned;
  } else if (patch.resolved !== undefined && author && !c.parentId) {
    set.resolved = !!patch.resolved; // a student may close their own question
  }
  if (Object.keys(set).length) await db().update(comments).set(set).where(eq(comments.id, id));
  return { ok: true };
}

export async function deleteComment(id: number, viewer: Viewer): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const [c] = await db().select().from(comments).where(eq(comments.id, id)).limit(1);
  if (!c) return { ok: true };
  if (c.userId !== viewer.id && !viewer.moderator) return { ok: false, error: "Not allowed.", status: 403 };
  await db().delete(comments).where(or(eq(comments.id, id), eq(comments.parentId, id)));
  return { ok: true };
}

export type InboxItem = { id: number; lessonId: number; lessonTitle: string; courseId: number; courseTitle: string; href: string; author: string; body: string; visibility: string; resolved: boolean; hidden: boolean; answered: boolean; createdAt: string };

/** Questions (top-level comments) across all courses for the moderation inbox, unanswered first. */
export async function inbox(f: { courseId?: number; filter?: string } = {}): Promise<InboxItem[]> {
  const where = [sql`c.parent_id IS NULL`, f.courseId ? sql`c.course_id = ${f.courseId}` : sql`TRUE`, f.filter === "open" ? sql`NOT c.resolved AND c.status = 'visible'` : f.filter === "instructor" ? sql`c.visibility = 'instructor'` : sql`TRUE`];
  const res = await db().execute(sql`
    SELECT c.id, c.lesson_id, l.title AS lesson_title, c.course_id, k.title AS course_title, k.slug AS course_slug, m.slug AS module_slug, l.slug AS lesson_slug, u.name AS author_name, u.email AS author_email, c.body, c.visibility, c.resolved, c.status, c.created_at,
      EXISTS (SELECT 1 FROM classroom_comments r JOIN users ru ON ru.id = r.user_id WHERE r.parent_id = c.id AND ru.role <> 'student') AS answered
    FROM classroom_comments c JOIN classroom_lessons l ON l.id = c.lesson_id JOIN classroom_modules m ON m.id = l.module_id JOIN classroom_courses k ON k.id = c.course_id JOIN users u ON u.id = c.user_id
    WHERE ${sql.join(where, sql` AND `)}
    ORDER BY (EXISTS (SELECT 1 FROM classroom_comments r JOIN users ru ON ru.id = r.user_id WHERE r.parent_id = c.id AND ru.role <> 'student')) ASC, c.created_at DESC
    LIMIT 200`);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({
    id: Number(r.id),
    lessonId: Number(r.lesson_id),
    lessonTitle: String(r.lesson_title),
    courseId: Number(r.course_id),
    courseTitle: String(r.course_title),
    href: `/classroom/${r.course_slug}/${r.module_slug}/${r.lesson_slug}#comment-${r.id}`,
    author: String(r.author_name || r.author_email),
    body: String(r.body),
    visibility: String(r.visibility),
    resolved: !!r.resolved,
    hidden: r.status === "hidden",
    answered: !!r.answered,
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}

/* -------------------------------------------------------------------------- */
/* Interactive block state                                                    */
/* -------------------------------------------------------------------------- */

type StateData = Record<string, unknown>;

export async function lessonBlockState(userId: string, lessonId: number): Promise<Record<number, StateData>> {
  const rows = await db().select().from(blockState).where(and(eq(blockState.userId, userId), eq(blockState.lessonId, lessonId)));
  return Object.fromEntries(rows.map((r) => [r.blockId, r.data as StateData]));
}

const ints = (v: unknown, max: number) => [...new Set((Array.isArray(v) ? v : []).map((n) => Math.trunc(Number(n))).filter((n) => Number.isInteger(n) && n >= 0 && n < max))].slice(0, max);

/** Saves the student's state in a block, shaped by the block type. Returns what was stored, or null when the block cannot hold state. */
export async function saveBlockState(userId: string, lessonId: number, blockId: number, input: unknown): Promise<{ data: StateData; results?: number[] } | null> {
  const [b] = await db().select().from(blocks).where(and(eq(blocks.id, blockId), eq(blocks.lessonId, lessonId))).limit(1);
  if (!b || !isInteractive(b.type)) return null;
  const s = (input && typeof input === "object" ? input : {}) as StateData;
  const cfg = (b.settings ?? {}) as { items?: unknown[]; options?: unknown[]; multiple?: unknown; show_results?: unknown };
  const size = Array.isArray(cfg.items) ? cfg.items.length : 0;
  const optionCount = Array.isArray(cfg.options) ? Math.min(8, cfg.options.length) : 0;
  let data: StateData = {};
  switch (b.type as BlockType) {
    case "checklist":
      data = { checked: ints(s.checked, size || 50) };
      break;
    case "flashcards":
      data = { known: ints(s.known, size || 100) };
      break;
    case "question":
      data = { answer: cleanMultiline(s.answer, 5000) };
      break;
    case "poll": {
      const picked = ints(s.choice, optionCount || 1);
      data = { choice: cfg.multiple && Number(cfg.multiple) ? picked : picked.slice(0, 1) };
      if (!(data.choice as number[]).length) return null; // a vote needs an option
      break;
    }
    default:
      return null;
  }
  await db()
    .insert(blockState)
    .values({ userId, blockId, lessonId, data, updatedAt: new Date() })
    .onConflictDoUpdate({ target: [blockState.userId, blockState.blockId], set: { data, updatedAt: new Date() } });
  if (b.type === "poll") return { data, results: cfg.show_results === 0 || cfg.show_results === false ? undefined : (await pollCounts([{ id: blockId, options: optionCount }]))[blockId] };
  return { data };
}

/** Votes per option for poll blocks. Anonymous: only counts leave the database. */
export async function pollCounts(blocksIn: { id: number; options: number }[]): Promise<Record<number, number[]>> {
  if (!blocksIn.length) return {};
  const ids = blocksIn.map((b) => b.id);
  const res = await db().execute(sql`
    SELECT s.block_id, c.value::int AS opt, COUNT(*)::int AS n
    FROM classroom_block_state s, jsonb_array_elements_text(s.data -> 'choice') AS c(value)
    WHERE s.block_id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})
    GROUP BY s.block_id, c.value`);
  const out: Record<number, number[]> = Object.fromEntries(blocksIn.map((b) => [b.id, Array(b.options).fill(0)]));
  for (const r of rowsOf<{ block_id: number; opt: number; n: number }>(res)) if (out[Number(r.block_id)] && Number(r.opt) < out[Number(r.block_id)].length) out[Number(r.block_id)][Number(r.opt)] = Number(r.n);
  return out;
}

/** Results of the polls in a lesson that this student has voted in (and whose author shows results). */
export async function lessonPollResults(userId: string, lessonId: number): Promise<Record<number, number[]>> {
  const res = await db().execute(sql`
    SELECT b.id, b.settings FROM classroom_blocks b JOIN classroom_block_state s ON s.block_id = b.id AND s.user_id = ${userId}
    WHERE b.lesson_id = ${lessonId} AND b.type = 'poll' AND COALESCE(s.data -> 'choice', '[]'::jsonb) <> '[]'::jsonb`);
  const polls = rowsOf<{ id: number; settings: { options?: unknown[]; show_results?: unknown } }>(res).filter((r) => !(r.settings?.show_results === 0 || r.settings?.show_results === false));
  return pollCounts(polls.map((r) => ({ id: Number(r.id), options: Array.isArray(r.settings?.options) ? r.settings.options.length : 0 })));
}

export type SharedAnswer = { blockId: number; lessonId: number; lessonTitle: string; courseId: number; courseTitle: string; href: string; prompt: string; answer: string; author: string; updatedAt: string };

/** Answers to Question boxes that the author chose to send to the instructor. */
export async function sharedAnswers(f: { courseId?: number } = {}): Promise<SharedAnswer[]> {
  const res = await db().execute(sql`
    SELECT s.block_id, s.lesson_id, l.title AS lesson_title, l.course_id, k.title AS course_title, k.slug AS course_slug, m.slug AS module_slug, l.slug AS lesson_slug, b.settings, s.data, u.name AS author_name, u.email AS author_email, s.updated_at
    FROM classroom_block_state s JOIN classroom_blocks b ON b.id = s.block_id JOIN classroom_lessons l ON l.id = s.lesson_id JOIN classroom_modules m ON m.id = l.module_id
      JOIN classroom_courses k ON k.id = l.course_id JOIN users u ON u.id = s.user_id
    WHERE b.type = 'question' AND (b.settings ->> 'share') IN ('1', 'true') AND COALESCE(s.data ->> 'answer', '') <> '' ${f.courseId ? sql`AND l.course_id = ${f.courseId}` : sql``}
    ORDER BY s.updated_at DESC LIMIT 200`);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({
    blockId: Number(r.block_id),
    lessonId: Number(r.lesson_id),
    lessonTitle: String(r.lesson_title),
    courseId: Number(r.course_id),
    courseTitle: String(r.course_title),
    href: `/classroom/${r.course_slug}/${r.module_slug}/${r.lesson_slug}`,
    prompt: String((r.settings as { prompt?: string })?.prompt ?? ""),
    answer: String((r.data as { answer?: string })?.answer ?? ""),
    author: String(r.author_name || r.author_email),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  }));
}
