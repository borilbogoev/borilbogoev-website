import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db/use";
import { formatPrice, type Img } from "./course-settings";
import { paymentReference } from "./access";

export type MyCourse = { id: number; slug: string; title: string; summary: string; image: Img; status: "pending" | "active"; total: number; done: number; href: string; reference: string | null; priceLabel: string };

/** The courses a user is enrolled in (or waiting to pay for), with progress and where to continue. */
export async function myCourses(userId: string): Promise<MyCourse[]> {
  const d = db();
  const res = await d.execute(sql`
    SELECT e.id AS enrolment_id, e.status, e.amount_cents, e.currency AS paid_currency, c.id, c.slug, c.title, c.summary, c.image,
      (SELECT COUNT(*) FROM classroom_lessons l WHERE l.course_id = c.id AND l.status = 'active')::int AS total,
      (SELECT COUNT(*) FROM classroom_progress p JOIN classroom_lessons l ON l.id = p.lesson_id WHERE p.user_id = e.user_id AND p.course_id = c.id AND p.completed_at IS NOT NULL AND l.status = 'active')::int AS done
    FROM classroom_enrolments e JOIN classroom_courses c ON c.id = e.course_id
    WHERE e.user_id = ${userId} AND e.status IN ('active', 'pending') AND c.status = 'active'
    ORDER BY e.updated_at DESC`);
  const rows = rowsOf<Record<string, unknown>>(res);
  if (!rows.length) return [];
  const ids = rows.map((r) => Number(r.id));
  const [last, first] = await Promise.all([
    d.execute(sql`
      SELECT DISTINCT ON (p.course_id) p.course_id, l.slug AS lesson, m.slug AS module
      FROM classroom_progress p JOIN classroom_lessons l ON l.id = p.lesson_id JOIN classroom_modules m ON m.id = l.module_id
      WHERE p.user_id = ${userId} AND l.status = 'active' ORDER BY p.course_id, p.updated_at DESC`),
    d.execute(sql`
      SELECT DISTINCT ON (l.course_id) l.course_id, l.slug AS lesson, m.slug AS module
      FROM classroom_lessons l JOIN classroom_modules m ON m.id = l.module_id
      WHERE l.status = 'active' AND l.course_id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) ORDER BY l.course_id, m.position, l.position`),
  ]);
  const lastBy = new Map(rowsOf<Record<string, unknown>>(last).map((r) => [Number(r.course_id), r]));
  const firstBy = new Map(rowsOf<Record<string, unknown>>(first).map((r) => [Number(r.course_id), r]));
  return rows.map((r) => {
    const id = Number(r.id);
    const slug = String(r.slug);
    const at = lastBy.get(id) ?? firstBy.get(id);
    const pending = r.status === "pending";
    return {
      id,
      slug,
      title: String(r.title),
      summary: String(r.summary ?? ""),
      image: (r.image ?? {}) as Img,
      status: pending ? "pending" : "active",
      total: Number(r.total),
      done: Number(r.done),
      href: at ? `/school/${slug}/${at.module}/${at.lesson}` : `/school/${slug}`,
      reference: pending ? paymentReference({ id: Number(r.enrolment_id) }) : null,
      priceLabel: formatPrice(Number(r.amount_cents), String(r.paid_currency)),
    };
  });
}
