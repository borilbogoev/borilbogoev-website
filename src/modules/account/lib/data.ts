// What a signed-in person sees in their own area: their courses and the forms they answered. Every query is scoped to the
// user's id or email, so nobody reads another person's data. People are matched to responses by the email they gave in the form.
import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db/use";
import { fieldsOf } from "@/modules/forms/lib/blocks";
import { getBlocks } from "@/modules/forms/lib/forms";
import { formPath } from "@/modules/forms/lib/paths";
import { getResponse, type AnswerValue } from "@/modules/forms/lib/responses";
import { myCourses } from "@/modules/school/lib/me";
import { sanitizeCourseSettings, type Img } from "@/modules/school/lib/course-settings";

export type AccountCourse = {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  image: Img;
  category: string;
  level: string;
  duration: string;
  pending: boolean;
  modules: number;
  lessons: number;
  done: number;
  joinedAt: Date;
  detailsHref: string;
  continueHref: string;
};

export async function accountCourses(userId: string): Promise<AccountCourse[]> {
  const [mine, res] = await Promise.all([
    myCourses(userId),
    db().execute(sql`
      SELECT e.created_at AS joined_at, c.id, c.settings, cat.name AS category,
        (SELECT COUNT(*) FROM classroom_modules m WHERE m.course_id = c.id AND EXISTS (SELECT 1 FROM classroom_lessons l WHERE l.module_id = m.id AND l.status = 'active'))::int AS modules
      FROM classroom_enrolments e JOIN classroom_courses c ON c.id = e.course_id LEFT JOIN classroom_categories cat ON cat.id = c.category_id
      WHERE e.user_id = ${userId} AND e.status IN ('active', 'pending') AND c.status = 'active'`),
  ]);
  const extra = new Map(rowsOf<Record<string, unknown>>(res).map((r) => [Number(r.id), r]));
  return mine.map((c) => {
    const x = extra.get(c.id);
    const s = sanitizeCourseSettings(x?.settings);
    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      subtitle: s.instructor ? `With ${s.instructor}` : "",
      summary: c.summary,
      image: c.image,
      category: String(x?.category ?? ""),
      level: s.level ? s.level.charAt(0).toUpperCase() + s.level.slice(1) : "",
      duration: s.duration,
      pending: c.status === "pending",
      modules: Number(x?.modules ?? 0),
      lessons: c.total,
      done: c.done,
      joinedAt: new Date(String(x?.joined_at ?? Date.now())),
      detailsHref: `/school/${c.slug}`,
      continueHref: c.href,
    };
  });
}

export type AccountForm = { formId: number; title: string; href: string | null; responses: number; lastAt: Date; lastId: number };

/** The forms this person answered, newest first, with how many times. Matched by user id (records added by an admin) or by the email given in an answer. */
export async function accountForms(userId: string, email: string): Promise<AccountForm[]> {
  const res = await db().execute(sql`
    SELECT f.id AS form_id, f.title, f.slug, COUNT(*)::int AS responses, MAX(r.created_at) AS last_at, (ARRAY_AGG(r.id ORDER BY r.created_at DESC))[1] AS last_id
    FROM bbforms_responses r JOIN bbforms_forms f ON f.id = r.form_id
    WHERE r.user_id = ${userId} OR EXISTS (SELECT 1 FROM bbforms_answers a WHERE a.response_id = r.id AND lower(a.value) = ${email.trim().toLowerCase()})
    GROUP BY f.id, f.title, f.slug
    ORDER BY MAX(r.created_at) DESC`);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({
    formId: Number(r.form_id),
    title: String(r.title),
    href: r.slug ? formPath(String(r.slug)) : null,
    responses: Number(r.responses),
    lastAt: new Date(String(r.last_at)),
    lastId: Number(r.last_id),
  }));
}

export type AccountResponse = { id: number; seq: number; createdAt: Date; status: string; preview: string };

export async function accountResponsesOf(userId: string, email: string, formId: number): Promise<AccountResponse[]> {
  const res = await db().execute(sql`
    SELECT r.id, r.seq, r.created_at, r.status FROM bbforms_responses r
    WHERE r.form_id = ${formId} AND (r.user_id = ${userId} OR EXISTS (SELECT 1 FROM bbforms_answers a WHERE a.response_id = r.id AND lower(a.value) = ${email.trim().toLowerCase()}))
    ORDER BY r.created_at DESC`);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({ id: Number(r.id), seq: Number(r.seq), createdAt: new Date(String(r.created_at)), status: String(r.status), preview: "" }));
}

export type AnswerLine = { key: string; label: string; value: string };
export type ResponseDetail = { id: number; seq: number; formId: number; formTitle: string; formHref: string | null; createdAt: Date; answers: AnswerLine[] };

const asText = (v: AnswerValue | undefined) => (Array.isArray(v) ? v.join(", ") : String(v ?? "")).trim();

/** One response with each answer under its question. Null unless the response belongs to this person. */
export async function accountResponse(userId: string, email: string, responseId: number): Promise<ResponseDetail | null> {
  if (!Number.isInteger(responseId) || responseId <= 0) return null;
  const owns = rowsOf(
    await db().execute(sql`
      SELECT 1 FROM bbforms_responses r WHERE r.id = ${responseId} AND (r.user_id = ${userId} OR EXISTS (SELECT 1 FROM bbforms_answers a WHERE a.response_id = r.id AND lower(a.value) = ${email.trim().toLowerCase()})) LIMIT 1`),
  );
  if (!owns.length) return null;
  const rec = await getResponse(responseId);
  if (!rec) return null;
  const [blocks, form] = await Promise.all([
    getBlocks(rec.form_id),
    db().execute(sql`SELECT title, slug FROM bbforms_forms WHERE id = ${rec.form_id}`),
  ]);
  const [f] = rowsOf<{ title: string; slug: string | null }>(form);
  const fields = fieldsOf(blocks);
  const known = new Set(fields.map((x) => x.key));
  const answers: AnswerLine[] = [];
  for (const field of fields) {
    const value = asText(rec.values[field.key]);
    if (value && field.type !== "file") answers.push({ key: field.key, label: field.label, value });
  }
  // Answers whose question was removed from the form later are still the person's: show them under their key.
  for (const [key, v] of Object.entries(rec.values)) {
    const value = asText(v);
    if (!known.has(key) && value) answers.push({ key, label: key.replace(/_/g, " "), value });
  }
  return { id: rec.id, seq: rec.seq, formId: rec.form_id, formTitle: f?.title ?? "Form", formHref: f?.slug ? formPath(f.slug) : null, createdAt: new Date(rec.created_at), answers };
}
