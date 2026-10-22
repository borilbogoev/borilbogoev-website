// Categories, courses, modules, lessons and blocks: storage and rules. Mirrors modules/presentations/lib/presentations.ts
// with two more levels (module, lesson) and no whole-tree save: a course has many lessons, so structure and lesson
// content are saved separately and block ids stay stable (students' answers hang on them).
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { schema } from "@/db";
import { db, rowsOf } from "@/db/use";
import { cleanSlug, cleanText } from "@/modules/forms/lib/sanitize";
import { blockWithDefaults, isBlockType, sanitizeBlock, type BlockType, type Settings } from "./blocks";
import { cleanAccess, cleanImage, cleanLanguage, cleanStatus, sanitizeCourseSettings, type AccessMode, type CourseSettings, type CourseStatus, type Img } from "./course-settings";

const { classroomCategories: categories, classroomCourses: courses, classroomModules: modules, classroomLessons: lessons, classroomBlocks: blocks, classroomLessonRevisions: revisions } = schema;

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type Category = { id: number; name: string; slug: string; summary: string; image: Img; position: number; courses: number };

export type Course = {
  id: number;
  title: string;
  slug: string;
  status: CourseStatus;
  categoryId: number | null;
  summary: string;
  image: Img;
  language: string;
  access: AccessMode;
  priceCents: number;
  currency: string;
  settings: CourseSettings;
  position: number;
  publishedAt: Date | null;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LessonMeta = { id: number; courseId: number; moduleId: number; title: string; slug: string; summary: string; image: Img; position: number; status: "draft" | "active"; preview: boolean; minutes: number };
export type ModuleNode = { id: number; courseId: number; title: string; slug: string; summary: string; image: Img; position: number; lessons: LessonMeta[] };
export type CourseTree = { course: Course; modules: ModuleNode[] };
export type Lesson = LessonMeta & { blocks: { id: number; type: BlockType; settings: Settings }[]; updatedAt: Date };

function hydrateCourse(r: typeof courses.$inferSelect): Course {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    status: cleanStatus(r.status) ?? "draft",
    categoryId: r.categoryId,
    summary: r.summary,
    image: r.image ?? {},
    language: r.language,
    access: cleanAccess(r.access),
    priceCents: r.priceCents,
    currency: r.currency,
    settings: sanitizeCourseSettings(r.settings),
    position: r.position,
    publishedAt: r.publishedAt,
    authorId: r.authorId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

const hydrateLessonMeta = (r: typeof lessons.$inferSelect): LessonMeta => ({
  id: r.id,
  courseId: r.courseId,
  moduleId: r.moduleId,
  title: r.title,
  slug: r.slug,
  summary: r.summary,
  image: r.image ?? {},
  position: r.position,
  status: r.status === "draft" ? "draft" : "active",
  preview: r.preview,
  minutes: r.minutes,
});

/** The course as a browser may see it: dates as text. */
export function publicCourse(c: Course) {
  const { publishedAt, createdAt, updatedAt, ...rest } = c;
  return { ...rest, publishedAt: publishedAt?.toISOString() ?? null, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() };
}

/* -------------------------------------------------------------------------- */
/* Slugs                                                                      */
/* -------------------------------------------------------------------------- */

/** Addresses under /classroom that belong to the app itself and cannot be a course. */
export const RESERVED_SLUGS = new Set(["category", "my", "sign-in", "api", "verify", "account", "search"]);

async function freeSlug(base: string, taken: (slug: string) => Promise<boolean>, fallback: string): Promise<string> {
  const root = cleanSlug(base).slice(0, 70) || fallback;
  let slug = root;
  for (let i = 2; i < 200; i++) {
    if (!(await taken(slug))) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

const courseSlug = (base: string, except = 0) =>
  freeSlug(
    RESERVED_SLUGS.has(cleanSlug(base)) ? `${base}-course` : base,
    async (s) => {
      const [t] = await db().select({ id: courses.id }).from(courses).where(eq(courses.slug, s)).limit(1);
      return !!t && t.id !== except;
    },
    "course",
  );

const moduleSlug = (courseId: number, base: string, except = 0) =>
  freeSlug(
    base,
    async (s) => {
      const [t] = await db().select({ id: modules.id }).from(modules).where(and(eq(modules.courseId, courseId), eq(modules.slug, s))).limit(1);
      return !!t && t.id !== except;
    },
    "module",
  );

const lessonSlug = (moduleId: number, base: string, except = 0) =>
  freeSlug(
    base,
    async (s) => {
      const [t] = await db().select({ id: lessons.id }).from(lessons).where(and(eq(lessons.moduleId, moduleId), eq(lessons.slug, s))).limit(1);
      return !!t && t.id !== except;
    },
    "lesson",
  );

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

export async function listCategories(onlyWithActiveCourses = false): Promise<Category[]> {
  const res = await db().execute(sql`
    SELECT c.id, c.name, c.slug, c.summary, c.image, c.position,
      (SELECT COUNT(*) FROM classroom_courses k WHERE k.category_id = c.id ${onlyWithActiveCourses ? sql`AND k.status = 'active'` : sql``})::int AS courses
    FROM classroom_categories c ORDER BY c.position, c.name`);
  const rows = rowsOf<Record<string, unknown>>(res).map((r) => ({ id: Number(r.id), name: String(r.name), slug: String(r.slug), summary: String(r.summary ?? ""), image: (r.image ?? {}) as Img, position: Number(r.position), courses: Number(r.courses) }));
  return onlyWithActiveCourses ? rows.filter((c) => c.courses > 0) : rows;
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return (await listCategories()).find((c) => c.slug === cleanSlug(slug)) ?? null;
}

export type CategoryInput = { name?: string; summary?: string; image?: unknown };

export async function createCategory(input: CategoryInput): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const name = cleanText(input.name, 80);
  const slug = cleanSlug(name);
  if (!name || !slug) return { ok: false, error: "Give the category a name." };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, error: "This name is reserved. Choose another." };
  const [taken] = await db().select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1);
  if (taken) return { ok: false, error: "A category with this name exists." };
  const [last] = await db().select({ p: categories.position }).from(categories).orderBy(desc(categories.position)).limit(1);
  const [row] = await db().insert(categories).values({ name, slug, summary: cleanText(input.summary, 300), image: cleanImage(input.image), position: (last?.p ?? 0) + 1 }).returning({ id: categories.id });
  return { ok: true, id: row.id };
}

export async function updateCategory(id: number, input: CategoryInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const set: Partial<typeof categories.$inferInsert> = {};
  if (input.name !== undefined) {
    const name = cleanText(input.name, 80);
    const slug = cleanSlug(name);
    if (!name || !slug) return { ok: false, error: "Give the category a name." };
    const [taken] = await db().select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1);
    if (taken && taken.id !== id) return { ok: false, error: "A category with this name exists." };
    set.name = name;
    set.slug = slug;
  }
  if (input.summary !== undefined) set.summary = cleanText(input.summary, 300);
  if (input.image !== undefined) set.image = cleanImage(input.image);
  if (Object.keys(set).length) await db().update(categories).set(set).where(eq(categories.id, id));
  return { ok: true };
}

/** Courses in the category are kept and become uncategorised (ON DELETE SET NULL). */
export async function deleteCategory(id: number): Promise<void> {
  await db().delete(categories).where(eq(categories.id, id));
}

export async function moveCategory(id: number, dir: -1 | 1): Promise<void> {
  const all = await listCategories();
  const i = all.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return;
  const order = all.map((c) => c.id);
  [order[i], order[j]] = [order[j], order[i]];
  for (let p = 0; p < order.length; p++) await db().update(categories).set({ position: p + 1 }).where(eq(categories.id, order[p]));
}

/* -------------------------------------------------------------------------- */
/* Courses                                                                    */
/* -------------------------------------------------------------------------- */

export async function getCourse(id: number): Promise<Course | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const [row] = await db().select().from(courses).where(eq(courses.id, id)).limit(1);
  return row ? hydrateCourse(row) : null;
}

export async function getCourseBySlug(slug: string): Promise<Course | null> {
  const clean = cleanSlug(slug);
  if (!clean) return null;
  const [row] = await db().select().from(courses).where(eq(courses.slug, clean)).limit(1);
  return row ? hydrateCourse(row) : null;
}

export type CourseListItem = Course & { categoryName: string; modules: number; lessons: number; students: number; pending: number };
export type CourseFilter = { q?: string; status?: string; category?: number };

/** Courses for the admin list, with counts. Archived courses are hidden unless asked for. */
export async function listCourses(f: CourseFilter = {}): Promise<CourseListItem[]> {
  const like = `%${(f.q ?? "").replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const where = [
    f.q ? sql`(c.title ILIKE ${like} OR c.slug ILIKE ${like})` : sql`TRUE`,
    f.status && cleanStatus(f.status) ? sql`c.status = ${f.status}` : sql`c.status <> 'archived'`,
    f.category ? sql`c.category_id = ${f.category}` : sql`TRUE`,
  ];
  const res = await db().execute(sql`
    SELECT c.*, COALESCE(k.name, '') AS category_name,
      (SELECT COUNT(*) FROM classroom_modules m WHERE m.course_id = c.id)::int AS module_count,
      (SELECT COUNT(*) FROM classroom_lessons l WHERE l.course_id = c.id)::int AS lesson_count,
      (SELECT COUNT(*) FROM classroom_enrolments e WHERE e.course_id = c.id AND e.status = 'active')::int AS student_count,
      (SELECT COUNT(*) FROM classroom_enrolments e WHERE e.course_id = c.id AND e.status = 'pending')::int AS pending_count
    FROM classroom_courses c LEFT JOIN classroom_categories k ON k.id = c.category_id
    WHERE ${sql.join(where, sql` AND `)}
    ORDER BY c.updated_at DESC`);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({
    ...hydrateCourse({
      id: Number(r.id),
      title: String(r.title),
      slug: String(r.slug),
      status: String(r.status),
      categoryId: r.category_id === null ? null : Number(r.category_id),
      summary: String(r.summary ?? ""),
      image: (r.image ?? {}) as Img,
      language: String(r.language),
      access: String(r.access),
      priceCents: Number(r.price_cents),
      currency: String(r.currency),
      settings: r.settings,
      position: Number(r.position),
      publishedAt: r.published_at ? new Date(r.published_at as string) : null,
      authorId: (r.author_id as string | null) ?? null,
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
    }),
    categoryName: String(r.category_name ?? ""),
    modules: Number(r.module_count),
    lessons: Number(r.lesson_count),
    students: Number(r.student_count),
    pending: Number(r.pending_count),
  }));
}

/** Active courses for the public catalog, optionally for one category. */
export async function listActiveCourses(categoryId?: number): Promise<(Course & { modules: number; lessons: number })[]> {
  const items = await listCourses({ status: "active", category: categoryId });
  return items.map((c) => c as Course & { modules: number; lessons: number }).sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
}

export async function indexableCourses(): Promise<{ slug: string; updatedAt: Date }[]> {
  const rows = await db().select().from(courses).where(eq(courses.status, "active"));
  return rows.map(hydrateCourse).filter((c) => c.settings.indexable).map((c) => ({ slug: c.slug, updatedAt: c.updatedAt }));
}

export type CreateCourse = { title: string; slug?: string; categoryId?: number | null; access?: string; template?: string };

export async function createCourse(opts: CreateCourse, authorId: string | null): Promise<number> {
  const title = cleanText(opts.title, 200) || "Untitled course";
  const slug = await courseSlug(opts.slug || title);
  const categoryId = opts.categoryId ? ((await db().select({ id: categories.id }).from(categories).where(eq(categories.id, opts.categoryId)).limit(1))[0]?.id ?? null) : null;
  const [row] = await db().insert(courses).values({ title, slug, status: "draft", categoryId, access: cleanAccess(opts.access), settings: sanitizeCourseSettings({}), authorId }).returning({ id: courses.id });
  if (opts.template !== "empty") {
    const m = await createModule(row.id, "Module 1");
    await createLesson(m, "Welcome", authorId);
  }
  return row.id;
}

export type CourseSave = {
  title?: string;
  slug?: string;
  status?: string;
  categoryId?: number | null;
  summary?: string;
  image?: unknown;
  language?: string;
  access?: string;
  price?: number; // in major units, such as 800 for AED 800
  currency?: string;
  settings?: unknown;
};

export async function saveCourse(id: number, input: CourseSave): Promise<{ ok: true; course: Course } | { ok: false; error: string }> {
  const before = await getCourse(id);
  if (!before) return { ok: false, error: "Course not found." };
  const set: Partial<typeof courses.$inferInsert> = { updatedAt: new Date() };
  if (input.title !== undefined) set.title = cleanText(input.title, 200) || "Untitled course";
  if (input.slug !== undefined) {
    const slug = cleanSlug(input.slug);
    if (slug.length < 2) return { ok: false, error: "The address needs at least two letters or numbers." };
    if (RESERVED_SLUGS.has(slug)) return { ok: false, error: `"${slug}" is reserved by the Classroom. Choose another address.` };
    const [taken] = await db().select({ id: courses.id }).from(courses).where(eq(courses.slug, slug)).limit(1);
    if (taken && taken.id !== id) return { ok: false, error: `The address /classroom/${slug} is already used by another course.` };
    set.slug = slug;
  }
  if (input.status !== undefined) {
    const status = cleanStatus(input.status);
    if (!status) return { ok: false, error: "Unknown status." };
    set.status = status;
    if (status === "active" && !before.publishedAt) set.publishedAt = new Date();
  }
  if (input.categoryId !== undefined) {
    const cid = Number(input.categoryId);
    set.categoryId = cid > 0 ? ((await db().select({ id: categories.id }).from(categories).where(eq(categories.id, cid)).limit(1))[0]?.id ?? null) : null;
  }
  if (input.summary !== undefined) set.summary = cleanText(input.summary, 300);
  if (input.image !== undefined) set.image = cleanImage(input.image);
  if (input.language !== undefined) set.language = cleanLanguage(input.language);
  if (input.access !== undefined) set.access = cleanAccess(input.access);
  if (input.price !== undefined) {
    const n = Number(input.price);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return { ok: false, error: "Enter a price between 0 and 1,000,000." };
    set.priceCents = Math.round(n * 100);
  }
  if (input.currency !== undefined) set.currency = /^[A-Z]{3}$/.test(String(input.currency)) ? String(input.currency) : before.currency;
  if (input.settings !== undefined) set.settings = sanitizeCourseSettings(input.settings, before.settings);
  const access = set.access ?? before.access;
  const price = set.priceCents ?? before.priceCents;
  if ((set.status ?? before.status) === "active" && access === "paid" && price <= 0) return { ok: false, error: "A paid course needs a price above zero before it goes live." };
  await db().update(courses).set(set).where(eq(courses.id, id));
  return { ok: true, course: (await getCourse(id)) as Course };
}

export async function deleteCourse(id: number): Promise<void> {
  // Modules, lessons, blocks, enrolments, progress, notes and comments go with it (ON DELETE CASCADE).
  await db().delete(courses).where(eq(courses.id, id));
}

/* -------------------------------------------------------------------------- */
/* Tree: modules and lessons                                                  */
/* -------------------------------------------------------------------------- */

export async function getTree(courseId: number, opts: { drafts?: boolean } = {}): Promise<CourseTree | null> {
  const course = await getCourse(courseId);
  if (!course) return null;
  const d = db();
  const [mods, less] = await Promise.all([
    d.select().from(modules).where(eq(modules.courseId, courseId)).orderBy(asc(modules.position), asc(modules.id)),
    d.select().from(lessons).where(eq(lessons.courseId, courseId)).orderBy(asc(lessons.position), asc(lessons.id)),
  ]);
  const byModule = new Map<number, LessonMeta[]>();
  for (const l of less) {
    if (!opts.drafts && l.status === "draft") continue;
    const list = byModule.get(l.moduleId) ?? [];
    list.push(hydrateLessonMeta(l));
    byModule.set(l.moduleId, list);
  }
  return {
    course,
    modules: mods.map((m) => ({ id: m.id, courseId: m.courseId, title: m.title, slug: m.slug, summary: m.summary, image: m.image ?? {}, position: m.position, lessons: byModule.get(m.id) ?? [] })),
  };
}

export async function createModule(courseId: number, title: string): Promise<number> {
  const clean = cleanText(title, 200) || "New module";
  const [last] = await db().select({ p: modules.position }).from(modules).where(eq(modules.courseId, courseId)).orderBy(desc(modules.position)).limit(1);
  const [row] = await db()
    .insert(modules)
    .values({ courseId, title: clean, slug: await moduleSlug(courseId, clean), position: (last?.p ?? -1) + 1 })
    .returning({ id: modules.id });
  await touchCourse(courseId);
  return row.id;
}

export type ModuleSave = { title?: string; slug?: string; summary?: string; image?: unknown };

export async function saveModule(id: number, input: ModuleSave): Promise<{ ok: true } | { ok: false; error: string }> {
  const [m] = await db().select().from(modules).where(eq(modules.id, id)).limit(1);
  if (!m) return { ok: false, error: "Module not found." };
  const set: Partial<typeof modules.$inferInsert> = {};
  if (input.title !== undefined) set.title = cleanText(input.title, 200) || "Untitled module";
  if (input.slug !== undefined) {
    const slug = cleanSlug(input.slug);
    if (slug.length < 1) return { ok: false, error: "The address needs at least one letter or number." };
    const [taken] = await db().select({ id: modules.id }).from(modules).where(and(eq(modules.courseId, m.courseId), eq(modules.slug, slug))).limit(1);
    if (taken && taken.id !== id) return { ok: false, error: "Another module in this course has this address." };
    set.slug = slug;
  }
  if (input.summary !== undefined) set.summary = cleanText(input.summary, 400);
  if (input.image !== undefined) set.image = cleanImage(input.image);
  if (Object.keys(set).length) await db().update(modules).set(set).where(eq(modules.id, id));
  await touchCourse(m.courseId);
  return { ok: true };
}

export async function deleteModule(id: number): Promise<number | null> {
  const [m] = await db().select().from(modules).where(eq(modules.id, id)).limit(1);
  if (!m) return null;
  await db().delete(modules).where(eq(modules.id, id)); // lessons, blocks, progress, notes and comments go with it
  await touchCourse(m.courseId);
  return m.courseId;
}

export async function createLesson(moduleId: number, title: string, authorId: string | null): Promise<number> {
  const [m] = await db().select().from(modules).where(eq(modules.id, moduleId)).limit(1);
  if (!m) return 0;
  const clean = cleanText(title, 200) || "New lesson";
  const [last] = await db().select({ p: lessons.position }).from(lessons).where(eq(lessons.moduleId, moduleId)).orderBy(desc(lessons.position)).limit(1);
  const [row] = await db()
    .insert(lessons)
    .values({ courseId: m.courseId, moduleId, title: clean, slug: await lessonSlug(moduleId, clean), position: (last?.p ?? -1) + 1, status: "draft" })
    .returning({ id: lessons.id });
  await db().insert(blocks).values([
    { lessonId: row.id, position: 0, type: "text", settings: blockWithDefaults("text", { content: "Write the lesson here." }) },
  ]);
  void authorId;
  await touchCourse(m.courseId);
  return row.id;
}

export async function deleteLesson(id: number): Promise<number | null> {
  const [l] = await db().select().from(lessons).where(eq(lessons.id, id)).limit(1);
  if (!l) return null;
  await db().delete(lessons).where(eq(lessons.id, id));
  await touchCourse(l.courseId);
  return l.courseId;
}

/** Applies a new order: the modules of a course and the lessons in each (a lesson may move to another module of the same course). */
export async function saveOrder(courseId: number, order: { id: number; lessons: number[] }[]): Promise<void> {
  const d = db();
  const mods = new Set((await d.select({ id: modules.id }).from(modules).where(eq(modules.courseId, courseId))).map((m) => m.id));
  const lessonIds = new Set((await d.select({ id: lessons.id }).from(lessons).where(eq(lessons.courseId, courseId))).map((l) => l.id));
  const seenLessons = new Set<number>();
  let mp = 0;
  for (const m of order) {
    if (!mods.has(m.id)) continue;
    await d.update(modules).set({ position: mp++ }).where(eq(modules.id, m.id));
    let lp = 0;
    for (const lid of m.lessons) {
      if (!lessonIds.has(lid) || seenLessons.has(lid)) continue;
      seenLessons.add(lid);
      const [cur] = await d.select({ moduleId: lessons.moduleId, title: lessons.title }).from(lessons).where(eq(lessons.id, lid)).limit(1);
      const set: Partial<typeof lessons.$inferInsert> = { position: lp++ };
      if (cur && cur.moduleId !== m.id) {
        set.moduleId = m.id;
        set.slug = await lessonSlug(m.id, cur.title, lid);
      }
      await d.update(lessons).set(set).where(eq(lessons.id, lid));
    }
  }
  await touchCourse(courseId);
}

async function touchCourse(id: number) {
  await db().update(courses).set({ updatedAt: new Date() }).where(eq(courses.id, id));
}

/* -------------------------------------------------------------------------- */
/* Lesson content                                                             */
/* -------------------------------------------------------------------------- */

export async function getLesson(id: number): Promise<Lesson | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const [row] = await db().select().from(lessons).where(eq(lessons.id, id)).limit(1);
  if (!row) return null;
  const bl = await db().select().from(blocks).where(eq(blocks.lessonId, id)).orderBy(asc(blocks.position), asc(blocks.id));
  return {
    ...hydrateLessonMeta(row),
    updatedAt: row.updatedAt,
    blocks: bl.filter((b) => isBlockType(b.type)).map((b) => ({ id: b.id, type: b.type as BlockType, settings: blockWithDefaults(b.type as BlockType, b.settings) })),
  };
}

/** A lesson by the addresses in its URL. */
export async function findLesson(courseSlug: string, moduleSlug: string, lessonSlug: string): Promise<{ course: Course; module: ModuleNode; lesson: LessonMeta; tree: CourseTree } | null> {
  const course = await getCourseBySlug(courseSlug);
  if (!course) return null;
  const tree = await getTree(course.id);
  const found = tree?.modules.find((m) => m.slug === cleanSlug(moduleSlug));
  const lesson = found?.lessons.find((l) => l.slug === cleanSlug(lessonSlug));
  return tree && found && lesson ? { course, module: found, lesson, tree } : null;
}

export type LessonSave = {
  title?: string;
  slug?: string;
  summary?: string;
  image?: unknown;
  status?: string;
  preview?: boolean;
  minutes?: number;
  /** The whole list of blocks, in order. A block with an `id` keeps it (and the students' answers); the rest are new. Blocks left out are deleted. */
  blocks?: { id?: number; type: string; settings: unknown }[];
};

const MAX_BLOCKS = 120;

export async function saveLesson(id: number, input: LessonSave, authorId: string | null): Promise<{ ok: true; lesson: Lesson } | { ok: false; error: string }> {
  const [cur] = await db().select().from(lessons).where(eq(lessons.id, id)).limit(1);
  if (!cur) return { ok: false, error: "Lesson not found." };
  const set: Partial<typeof lessons.$inferInsert> = { updatedAt: new Date() };
  if (input.title !== undefined) set.title = cleanText(input.title, 200) || "Untitled lesson";
  if (input.slug !== undefined) {
    const slug = cleanSlug(input.slug);
    if (slug.length < 1) return { ok: false, error: "The address needs at least one letter or number." };
    const [taken] = await db().select({ id: lessons.id }).from(lessons).where(and(eq(lessons.moduleId, cur.moduleId), eq(lessons.slug, slug))).limit(1);
    if (taken && taken.id !== id) return { ok: false, error: "Another lesson in this module has this address." };
    set.slug = slug;
  }
  if (input.summary !== undefined) set.summary = cleanText(input.summary, 400);
  if (input.image !== undefined) set.image = cleanImage(input.image);
  if (input.status !== undefined) set.status = input.status === "draft" ? "draft" : "active";
  if (input.preview !== undefined) set.preview = !!input.preview;
  if (input.minutes !== undefined) set.minutes = Math.min(1000, Math.max(0, Math.trunc(Number(input.minutes)) || 0));
  await db().update(lessons).set(set).where(eq(lessons.id, id));

  if (Array.isArray(input.blocks)) {
    if (input.blocks.length > MAX_BLOCKS) return { ok: false, error: `A lesson can hold up to ${MAX_BLOCKS} blocks. Split it into two lessons.` };
    const d = db();
    const existing = new Set((await d.select({ id: blocks.id }).from(blocks).where(eq(blocks.lessonId, id))).map((b) => b.id));
    const keep: number[] = [];
    let position = 0;
    for (const b of input.blocks) {
      if (!isBlockType(b.type)) continue;
      const settings = sanitizeBlock(b.type, b.settings);
      const bid = Number(b.id);
      if (bid > 0 && existing.has(bid)) {
        await d.update(blocks).set({ position, type: b.type, settings }).where(eq(blocks.id, bid));
        keep.push(bid);
      } else {
        const [row] = await d.insert(blocks).values({ lessonId: id, position, type: b.type, settings }).returning({ id: blocks.id });
        keep.push(row.id);
      }
      position++;
    }
    const drop = [...existing].filter((x) => !keep.includes(x));
    if (drop.length) await d.delete(blocks).where(inArray(blocks.id, drop)); // students' answers to these blocks go with them
  }
  await touchCourse(cur.courseId);
  const lesson = (await getLesson(id)) as Lesson;
  await snapshot(lesson, authorId);
  return { ok: true, lesson };
}

const KEEP_REVISIONS = 30;

async function snapshot(l: Lesson, authorId: string | null) {
  const d = db();
  await d.insert(revisions).values({
    lessonId: l.id,
    authorId,
    snapshot: { title: l.title, summary: l.summary, image: l.image, preview: l.preview, minutes: l.minutes, blocks: l.blocks.map((b) => ({ type: b.type, settings: b.settings })) },
  });
  const old = await d.select({ id: revisions.id }).from(revisions).where(eq(revisions.lessonId, l.id)).orderBy(desc(revisions.createdAt), desc(revisions.id)).offset(KEEP_REVISIONS);
  if (old.length) await d.delete(revisions).where(inArray(revisions.id, old.map((r) => r.id)));
}

export async function listRevisions(lessonId: number) {
  const rows = await db().select({ id: revisions.id, createdAt: revisions.createdAt, authorId: revisions.authorId, snapshot: revisions.snapshot }).from(revisions).where(eq(revisions.lessonId, lessonId)).orderBy(desc(revisions.createdAt), desc(revisions.id));
  return rows.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), authorId: r.authorId, blocks: ((r.snapshot as { blocks?: unknown[] })?.blocks ?? []).length }));
}

/** Puts a snapshot back as the lesson content. Blocks come back as new blocks, so students' answers to the old ones are not carried over. */
export async function restoreRevision(lessonId: number, revisionId: number, authorId: string | null) {
  const [rev] = await db().select().from(revisions).where(eq(revisions.id, revisionId)).limit(1);
  if (!rev || rev.lessonId !== lessonId) return { ok: false as const, error: "Revision not found." };
  const snap = rev.snapshot as { title?: string; summary?: string; image?: unknown; preview?: boolean; minutes?: number; blocks?: { type: string; settings: unknown }[] };
  return saveLesson(lessonId, { title: snap.title, summary: snap.summary, image: snap.image, preview: snap.preview, minutes: snap.minutes, blocks: snap.blocks }, authorId);
}
