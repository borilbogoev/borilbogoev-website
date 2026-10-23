// Reads for the public player pages. Wrapped in React `cache`, so the layout and the page of one request share a single query.
import { cache } from "react";
import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db/use";
import { formatPrice } from "./course-settings";
import { getCourseBySlug, getTree, type Course, type ModuleNode } from "./courses";
import type { OutlineModule, ShellCourse } from "../components/types";

export const loadPublicCourse = cache(async (slug: string): Promise<{ course: Course; modules: ModuleNode[] } | null> => {
  const course = await getCourseBySlug(decodeURIComponent(slug));
  if (!course || course.status !== "active") return null;
  const tree = await getTree(course.id);
  return tree ? { course, modules: tree.modules } : null;
});

export const shellCourse = (c: Course, opts: { preview?: boolean } = {}): ShellCourse => ({ id: c.id, slug: c.slug, title: c.title, access: c.access, priceLabel: formatPrice(c.access === "paid" ? c.priceCents : 0, c.currency), comments: !!c.settings.comments, base: opts.preview ? `/admin/preview/school/${c.slug}` : `/school/${c.slug}`, preview: opts.preview });

export const outlineOf = (modules: ModuleNode[]): OutlineModule[] =>
  modules.map((m) => ({ id: m.id, slug: m.slug, title: m.title, summary: m.summary, lessons: m.lessons.map((l) => ({ id: l.id, slug: l.slug, title: l.title, summary: l.summary, minutes: l.minutes, preview: l.preview, draft: l.status === "draft" })) }));

/** Every public lesson address, to prebuild the pages. Empty when there is no database (a build without DATABASE_URL). */
export async function allLessonParams(): Promise<{ course: string; module: string; lesson: string }[]> {
  try {
    const res = await db().execute(sql`
      SELECT c.slug AS course, m.slug AS module, l.slug AS lesson
      FROM classroom_lessons l JOIN classroom_modules m ON m.id = l.module_id JOIN classroom_courses c ON c.id = l.course_id
      WHERE c.status = 'active' AND l.status = 'active'`);
    return rowsOf<{ course: string; module: string; lesson: string }>(res);
  } catch {
    return [];
  }
}

export async function allModuleParams(): Promise<{ course: string; module: string }[]> {
  try {
    const res = await db().execute(sql`SELECT c.slug AS course, m.slug AS module FROM classroom_modules m JOIN classroom_courses c ON c.id = m.course_id WHERE c.status = 'active'`);
    return rowsOf<{ course: string; module: string }>(res);
  } catch {
    return [];
  }
}
