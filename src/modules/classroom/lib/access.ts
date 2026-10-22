// Who may learn what. Staff (classroom.view) see every course and lesson. Students need an active enrolment; a paid course
// is first "pending" (the student has the bank details) and an admin confirms the transfer. People are ordinary users.
import { and, desc, eq, sql } from "drizzle-orm";
import { schema } from "@/db";
import { db, rowsOf } from "@/db/use";
import { can } from "@/modules/auth/roles";
import type { CurrentUser } from "@/modules/auth/current";
import { sendMail } from "@/modules/forms/lib/notify";
import { getGlobalSettings } from "@/modules/forms/lib/settings-store";
import { escapeHtml } from "@/modules/forms/lib/markdown";
import { site } from "@/content/site";
import type { Course, LessonMeta } from "./courses";
import { getSettings } from "./settings-store";

const { classroomEnrolments: enrolments } = schema;

export type EnrolmentStatus = "pending" | "active" | "revoked";
export type Enrolment = { id: number; userId: string; courseId: number; status: EnrolmentStatus; source: string; amountCents: number; currency: string; paidAt: string | null; note: string; createdAt: string };

const toEnrolment = (r: typeof enrolments.$inferSelect): Enrolment => ({
  id: r.id,
  userId: r.userId,
  courseId: r.courseId,
  status: r.status === "pending" || r.status === "revoked" ? r.status : "active",
  source: r.source,
  amountCents: r.amountCents,
  currency: r.currency,
  paidAt: r.paidAt?.toISOString() ?? null,
  note: r.note,
  createdAt: r.createdAt.toISOString(),
});

export async function getEnrolment(userId: string, courseId: number): Promise<Enrolment | null> {
  const [r] = await db().select().from(enrolments).where(and(eq(enrolments.userId, userId), eq(enrolments.courseId, courseId))).limit(1);
  return r ? toEnrolment(r) : null;
}

/** The payment reference a student writes in the bank transfer. Stable and short. */
export const paymentReference = (e: Pick<Enrolment, "id">) => `CR-${String(e.id).padStart(5, "0")}`;

export type Access = { ok: true; reason: "staff" | "enrolled" | "preview" } | { ok: false; reason: "signin" | "enrol" | "pending" | "closed" };

/** Whether `user` (null when signed out) may open a lesson of `course`. */
export async function lessonAccess(user: CurrentUser | null, course: Course, lesson: Pick<LessonMeta, "preview" | "status">): Promise<Access> {
  if (user && can(user.role, "classroom.view")) return { ok: true, reason: "staff" };
  if (course.status !== "active" || lesson.status !== "active") return { ok: false, reason: "closed" };
  const e = user ? await getEnrolment(user.id, course.id) : null;
  if (e?.status === "active") return { ok: true, reason: "enrolled" }; // an enrolled student in a free-preview lesson is still a student: they can ask and answer
  if (lesson.preview) return { ok: true, reason: "preview" };
  if (!user) return { ok: false, reason: "signin" };
  if (!e || e.status === "revoked") return { ok: false, reason: "enrol" };
  return { ok: false, reason: "pending" };
}

export type EnrolResult = { ok: true; enrolment: Enrolment; reference: string | null } | { ok: false; error: string };

/** A signed-in user enrols themselves. Free: active at once. Paid: pending until an admin confirms the transfer. */
export async function enrolSelf(user: CurrentUser, course: Course): Promise<EnrolResult> {
  if (course.status !== "active") return { ok: false, error: "This course is not open for enrolment." };
  if (!can(user.role, "classroom.learn")) return { ok: false, error: "Enrol with a student account." };
  if (course.access === "invite") return { ok: false, error: "This course is by invitation. Ask for access and you will be added." };
  const existing = await getEnrolment(user.id, course.id);
  if (existing?.status === "revoked") return { ok: false, error: "Your access to this course was removed. Contact us to restore it." };
  if (existing) return { ok: true, enrolment: existing, reference: existing.status === "pending" ? paymentReference(existing) : null };

  const paid = course.access === "paid" && course.priceCents > 0;
  const [row] = await db()
    .insert(enrolments)
    .values({ userId: user.id, courseId: course.id, status: paid ? "pending" : "active", source: "self", amountCents: paid ? course.priceCents : 0, currency: course.currency })
    .onConflictDoNothing()
    .returning();
  const enrolment = row ? toEnrolment(row) : ((await getEnrolment(user.id, course.id)) as Enrolment);
  if (row && paid) void notifyPending(user, course, enrolment);
  return { ok: true, enrolment, reference: paid ? paymentReference(enrolment) : null };
}

async function notifyPending(user: CurrentUser, course: Course, e: Enrolment) {
  try {
    const [g, cs] = await Promise.all([getGlobalSettings(), getSettings()]);
    const to = cs.notify_to || process.env.INQUIRY_TO_EMAIL;
    if (!to) return;
    const price = `${e.currency} ${(e.amountCents / 100).toLocaleString("en-US")}`;
    await sendMail(
      {
        to: [to],
        subject: `Classroom: ${user.name || user.email} wants to join ${course.title}`,
        html: `<p><strong>${escapeHtml(user.name || user.email)}</strong> (${escapeHtml(user.email)}) enrolled in <strong>${escapeHtml(course.title)}</strong> and will pay ${escapeHtml(price)} by bank transfer.</p><p>Reference: <strong>${paymentReference(e)}</strong></p><p>When the transfer arrives, confirm it in <a href="${site.url}/admin/classroom/students">Admin &gt; Classroom &gt; Students</a>.</p>`,
      },
      g,
    );
  } catch (error) {
    console.error("[classroom] enrolment mail failed", error instanceof Error ? error.message : error);
  }
}

/* -------------------------------------------------------------------------- */
/* Admin                                                                      */
/* -------------------------------------------------------------------------- */

export type EnrolmentRow = Enrolment & { userEmail: string; userName: string; userRole: string; userStatus: string; courseTitle: string; reference: string; completed: number; lessons: number };

export async function listEnrolments(f: { courseId?: number; status?: string; userId?: string; q?: string } = {}): Promise<EnrolmentRow[]> {
  const like = `%${(f.q ?? "").replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const where = [
    f.courseId ? sql`e.course_id = ${f.courseId}` : sql`TRUE`,
    f.status ? sql`e.status = ${f.status}` : sql`TRUE`,
    f.userId ? sql`e.user_id = ${f.userId}` : sql`TRUE`,
    f.q ? sql`(u.email ILIKE ${like} OR u.name ILIKE ${like})` : sql`TRUE`,
  ];
  const res = await db().execute(sql`
    SELECT e.*, u.email AS user_email, u.name AS user_name, u.role AS user_role, u.status AS user_status, c.title AS course_title,
      (SELECT COUNT(*) FROM classroom_progress p WHERE p.user_id = e.user_id AND p.course_id = e.course_id AND p.completed_at IS NOT NULL)::int AS completed,
      (SELECT COUNT(*) FROM classroom_lessons l WHERE l.course_id = e.course_id AND l.status = 'active')::int AS lessons
    FROM classroom_enrolments e JOIN users u ON u.id = e.user_id JOIN classroom_courses c ON c.id = e.course_id
    WHERE ${sql.join(where, sql` AND `)}
    ORDER BY (e.status = 'pending') DESC, e.created_at DESC
    LIMIT 500`);
  return rowsOf<Record<string, unknown>>(res).map((r) => {
    const e: Enrolment = {
      id: Number(r.id),
      userId: String(r.user_id),
      courseId: Number(r.course_id),
      status: r.status === "pending" || r.status === "revoked" ? r.status : "active",
      source: String(r.source),
      amountCents: Number(r.amount_cents),
      currency: String(r.currency),
      paidAt: r.paid_at ? new Date(r.paid_at as string).toISOString() : null,
      note: String(r.note ?? ""),
      createdAt: new Date(r.created_at as string).toISOString(),
    };
    return { ...e, userEmail: String(r.user_email), userName: String(r.user_name ?? ""), userRole: String(r.user_role), userStatus: String(r.user_status), courseTitle: String(r.course_title), reference: paymentReference(e), completed: Number(r.completed), lessons: Number(r.lessons) };
  });
}

/** Enrols or re-activates a user in a course (an admin action). The price paid is kept for the record. */
export async function adminEnrol(userId: string, course: Course, opts: { note?: string; paid?: boolean } = {}): Promise<Enrolment> {
  const now = new Date();
  const values = { status: "active", source: "admin", updatedAt: now, ...(opts.paid ? { paidAt: now } : {}), ...(opts.note !== undefined ? { note: opts.note.slice(0, 500) } : {}) };
  const [row] = await db()
    .insert(enrolments)
    .values({ userId, courseId: course.id, status: "active", source: "admin", amountCents: course.access === "paid" ? course.priceCents : 0, currency: course.currency, paidAt: opts.paid ? now : null, note: (opts.note ?? "").slice(0, 500) })
    .onConflictDoUpdate({ target: [enrolments.userId, enrolments.courseId], set: values })
    .returning();
  return toEnrolment(row);
}

export async function setEnrolment(id: number, patch: { status?: EnrolmentStatus; note?: string }): Promise<Enrolment | null> {
  const set: Partial<typeof enrolments.$inferInsert> = { updatedAt: new Date() };
  if (patch.status) {
    set.status = patch.status;
    if (patch.status === "active") set.paidAt = sql`COALESCE(${enrolments.paidAt}, now())` as unknown as Date; // confirming a transfer stamps the date once
  }
  if (patch.note !== undefined) set.note = patch.note.slice(0, 500);
  const [row] = await db().update(enrolments).set(set).where(eq(enrolments.id, id)).returning();
  return row ? toEnrolment(row) : null;
}

export async function deleteEnrolment(id: number): Promise<void> {
  await db().delete(enrolments).where(eq(enrolments.id, id));
}

/** Courses a user is enrolled in, newest first. */
export async function enrolmentsOf(userId: string): Promise<Enrolment[]> {
  const rows = await db().select().from(enrolments).where(eq(enrolments.userId, userId)).orderBy(desc(enrolments.createdAt));
  return rows.map(toEnrolment);
}
