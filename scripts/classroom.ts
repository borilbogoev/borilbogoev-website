// Manage the Classroom from the terminal, without opening the admin. Built so an AI assistant (or you) can create and edit a whole
// course (modules, lessons, blocks) from one spec file in seconds.
//
//   npx tsx scripts/classroom.ts <command> [arguments]
//
//   catalog [type]                     every block type with its settings (JSON), the course settings and the choices. Start here.
//   settings                           what is configured (bank details, Bunny.net, sign-up). Never prints a secret.
//   categories                         the categories a spec can use
//   list                               all courses with counts
//   get <id|slug> [--blocks]           one course with its modules and lessons (and the blocks with --blocks) and the brand check
//   validate <file.json>               sanitise a course spec and run the brand check; writes nothing
//   create <file.json> [--publish]     create a course from a spec (see docs/classroom.md)
//   update <id|slug> <file.json> [--prune --yes]
//                                      update a course from a spec: modules and lessons are matched by address, new ones are created,
//                                      blocks keep their students' answers when the type at the same position is unchanged.
//                                      Anything not in the spec is kept, unless --prune --yes deletes it.
//   status <id|slug> <draft|active|inactive|archived>
//   stats [id|slug] [--days 7|30|90]   the dashboard numbers
//   students [id|slug] [--status pending|active|revoked]
//   enrol <id|slug> <email> [--name "Name"] [--paid] [--note "text"]   add a student (creates a Student account if needed)
//   confirm <enrolmentId>              confirm a bank transfer
//   delete <id|slug> --yes
//   refresh                            ask the live site to rebuild the cached public pages now
//
// Output is JSON. It runs against DATABASE_URL (from .env.local). After a change to a live course it asks the site to refresh the
// pages at once when CLASSROOM_API_TOKEN (or LANDING_API_TOKEN or CRON_SECRET) is set; otherwise pages refresh within 5 minutes.
import { readFileSync } from "node:fs";

try {
  process.loadEnvFile(".env.local");
} catch {
  // DATABASE_URL may already be in the environment
}

const args = process.argv.slice(2);
const cmd = args[0];
const rest = args.slice(1).filter((a, i, all) => !a.startsWith("--") && !["--name", "--note", "--days", "--status"].includes(all[i - 1] ?? ""));
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i > -1 ? args[i + 1] : undefined;
};
const out = (v: unknown) => console.log(JSON.stringify(v, null, 2));
const fail = (message: string): never => {
  console.error(JSON.stringify({ error: message }));
  process.exit(1);
};

type BlockSpec = { type: string; settings?: Record<string, unknown> } & Record<string, unknown>;
type LessonSpec = { title: string; slug?: string; summary?: string; minutes?: number; preview?: boolean; draft?: boolean; image?: { url?: string }; blocks?: BlockSpec[] };
type ModuleSpec = { title: string; slug?: string; summary?: string; image?: { url?: string }; lessons?: LessonSpec[] };
type Spec = {
  title?: string;
  slug?: string;
  status?: string;
  category?: string;
  summary?: string;
  image?: { url?: string };
  language?: string;
  access?: string;
  price?: number;
  currency?: string;
  settings?: Record<string, unknown>;
  modules?: ModuleSpec[];
};

async function main() {
  const { BLOCKS, BLOCK_GROUPS, isBlockType, sanitizeBlock } = await import("../src/modules/classroom/lib/blocks");
  const { brandIssues } = await import("../src/modules/classroom/lib/brand");
  const courses = await import("../src/modules/classroom/lib/courses");
  const cs = await import("../src/modules/classroom/lib/course-settings");
  const access = await import("../src/modules/classroom/lib/access");
  const { parseVideoRef } = await import("../src/modules/classroom/lib/media");
  const { getSettings, hasBunnyKey } = await import("../src/modules/classroom/lib/settings-store");
  const { bankConfigured, CURRENCIES } = await import("../src/modules/classroom/lib/settings");
  const stats = await import("../src/modules/classroom/lib/stats");
  const { cleanSlug } = await import("../src/modules/forms/lib/sanitize");
  const { createUser, getUserByEmail } = await import("../src/modules/auth/users");
  const { site } = await import("../src/content/site");

  const siteUrl = process.env.CLASSROOM_SITE_URL || process.env.LANDING_SITE_URL || site.url;
  const urlOf = (slug: string) => `${siteUrl}/classroom/${slug}`;

  const readSpec = (file: string | undefined): Spec => {
    if (!file) return fail("Give the path of a JSON file.");
    try {
      return JSON.parse(readFileSync(file, "utf8")) as Spec;
    } catch (e) {
      return fail(`Cannot read ${file}: ${e instanceof Error ? e.message : e}`);
    }
  };
  const find = async (ref: string | undefined) => {
    if (!ref) return fail("Give the course id or address (slug).");
    const n = Number(ref);
    return ((Number.isInteger(n) && n > 0 ? await courses.getCourse(n) : await courses.getCourseBySlug(ref)) ?? fail(`No course "${ref}".`)) as NonNullable<Awaited<ReturnType<typeof courses.getCourse>>>;
  };
  const refresh = async () => {
    const token = process.env.CLASSROOM_API_TOKEN || process.env.LANDING_API_TOKEN || process.env.CRON_SECRET;
    if (!token) return { refreshed: false, note: "No CLASSROOM_API_TOKEN set: public pages update within 5 minutes." };
    try {
      const res = await fetch(`${siteUrl}/api/classroom/revalidate`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      return { refreshed: res.ok, refresh_status: res.status };
    } catch (e) {
      return { refreshed: false, note: String(e) };
    }
  };

  /** A block of a spec: `settings` or the keys next to `type`, whichever the author wrote. */
  const settingsOf = (b: BlockSpec): Record<string, unknown> => {
    const flat: Record<string, unknown> = { ...b };
    delete flat.type;
    delete flat.settings;
    return { ...flat, ...(b.settings ?? {}) };
  };

  /** Everything wrong or doubtful in a spec, without writing anything. */
  const analyze = async (spec: Spec) => {
    const problems: string[] = [];
    const library = (await getSettings().catch(() => null))?.bunny_library_id ?? "";
    const lessons: { where: string; title: string; blocks: { id: number; type: ReturnType<typeof Object>; settings: Record<string, unknown> }[]; summary: string; image: object }[] = [];
    if (!spec.title) problems.push('The spec needs a "title".');
    if (spec.access && !cs.ACCESS_MODES.includes(spec.access as never)) problems.push(`access "${spec.access}" is not one of: ${cs.ACCESS_MODES.join(", ")}`);
    if (spec.access === "paid" && !(Number(spec.price) > 0)) problems.push('A paid course needs a "price" above zero.');
    if (spec.currency && !(CURRENCIES as readonly string[]).includes(spec.currency)) problems.push(`currency "${spec.currency}" is not one of: ${CURRENCIES.join(", ")}`);
    if (spec.language && !(spec.language in cs.LANGUAGES)) problems.push(`language "${spec.language}" is not one of: ${Object.keys(cs.LANGUAGES).join(", ")}`);
    const seenModules = new Set<string>();
    (spec.modules ?? []).forEach((m, mi) => {
      const mslug = cleanSlug(m.slug || m.title);
      if (!m.title) problems.push(`modules[${mi}]: needs a "title".`);
      if (seenModules.has(mslug)) problems.push(`modules[${mi}]: the address "${mslug}" is used twice.`);
      seenModules.add(mslug);
      const seenLessons = new Set<string>();
      (m.lessons ?? []).forEach((l, li) => {
        const where = `modules[${mi}].lessons[${li}]`;
        const lslug = cleanSlug(l.slug || l.title);
        if (!l.title) problems.push(`${where}: needs a "title".`);
        if (seenLessons.has(lslug)) problems.push(`${where}: the address "${lslug}" is used twice in this module.`);
        seenLessons.add(lslug);
        const blocks: { id: number; type: never; settings: Record<string, unknown> }[] = [];
        (l.blocks ?? []).forEach((b, bi) => {
          if (!isBlockType(b.type)) return void problems.push(`${where}.blocks[${bi}]: unknown type "${b.type}". Run: catalog`);
          const given = settingsOf(b);
          const known = new Set(BLOCKS[b.type].controls.map((c) => c.key));
          for (const k of Object.keys(given)) if (!known.has(k)) problems.push(`${where}.blocks[${bi}] (${b.type}): unknown setting "${k}" is ignored`);
          if (b.type === "video" && given.source && !parseVideoRef(String(given.source), library)) problems.push(`${where}.blocks[${bi}] (video): "${given.source}" is not a Bunny.net video ID or a YouTube or Vimeo link${library ? "" : " (the Bunny.net library ID is not set yet, so a bare video ID cannot be checked)"}.`);
          blocks.push({ id: bi + 1, type: b.type as never, settings: sanitizeBlock(b.type, given) });
        });
        lessons.push({ where, title: l.title, blocks: blocks as never, summary: l.summary ?? "", image: l.image ?? {} });
      });
    });
    const issues = lessons.flatMap((l) => brandIssues({ title: l.title, summary: l.summary, image: l.image as never, blocks: l.blocks as never }).filter((i) => i.level === "warn").map((i) => `${l.where} "${l.title}": ${i.message}`));
    return { problems, issues, modules: (spec.modules ?? []).length, lessons: lessons.length, blocks: lessons.reduce((n, l) => n + l.blocks.length, 0) };
  };

  const categoryId = async (name: string | undefined): Promise<number | null | undefined> => {
    if (name === undefined) return undefined;
    if (!name) return null;
    const existing = (await courses.listCategories()).find((c) => c.slug === cleanSlug(name) || c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const created = await courses.createCategory({ name });
    return created.ok ? created.id : fail(created.error);
  };

  const courseFields = async (spec: Spec) => ({
    title: spec.title,
    summary: spec.summary,
    image: spec.image,
    language: spec.language,
    access: spec.access,
    price: spec.price,
    currency: spec.currency,
    categoryId: await categoryId(spec.category),
    settings: spec.settings,
  });
  const strip = <T extends Record<string, unknown>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

  /** Writes the modules and lessons of a spec into a course. Matches by address, creates what is missing, keeps the rest. */
  const applyModules = async (courseId: number, spec: Spec, prune: boolean) => {
    const tree = (await courses.getTree(courseId, { drafts: true }))!;
    const order: { id: number; lessons: number[] }[] = [];
    const touched = { modules: 0, lessons: 0, created: 0 };
    const unmatched = new Set(tree.modules.map((m) => m.id));
    for (const ms of spec.modules ?? []) {
      const mslug = cleanSlug(ms.slug || ms.title);
      let mod = tree.modules.find((m) => m.slug === mslug) ?? tree.modules.find((m) => m.title === ms.title);
      let mid: number;
      if (mod) {
        mid = mod.id;
        unmatched.delete(mid);
      } else {
        mid = await courses.createModule(courseId, ms.title);
        touched.created++;
        mod = { id: mid, lessons: [] } as never;
      }
      const saved = await courses.saveModule(mid, strip({ title: ms.title, slug: mslug, summary: ms.summary, image: ms.image }));
      if (!saved.ok) fail(saved.error);
      touched.modules++;
      const lessonIds: number[] = [];
      const existing = [...(mod?.lessons ?? [])];
      const keep = new Set(existing.map((l) => l.id));
      for (const ls of ms.lessons ?? []) {
        const lslug = cleanSlug(ls.slug || ls.title);
        const cur = existing.find((l) => l.slug === lslug) ?? existing.find((l) => l.title === ls.title);
        let lid: number;
        let oldBlocks: { id: number; type: string }[] = [];
        if (cur) {
          lid = cur.id;
          keep.delete(lid);
          oldBlocks = (await courses.getLesson(lid))?.blocks ?? [];
        } else {
          lid = await courses.createLesson(mid, ls.title, null);
          touched.created++;
        }
        const blocks = (ls.blocks ?? []).map((b, i) => ({ id: oldBlocks[i]?.type === b.type ? oldBlocks[i].id : undefined, type: b.type, settings: settingsOf(b) }));
        const res = await courses.saveLesson(lid, strip({ title: ls.title, slug: lslug, summary: ls.summary, image: ls.image, minutes: ls.minutes, preview: ls.preview, status: ls.draft ? "draft" : "active", blocks: ls.blocks ? blocks : undefined }), null);
        if (!res.ok) fail(res.error);
        touched.lessons++;
        lessonIds.push(lid);
      }
      for (const lid of keep) {
        if (prune) await courses.deleteLesson(lid);
        else lessonIds.push(lid);
      }
      order.push({ id: mid, lessons: lessonIds });
    }
    for (const id of unmatched) {
      if (prune) await courses.deleteModule(id);
      else order.push({ id, lessons: (tree.modules.find((m) => m.id === id)?.lessons ?? []).map((l) => l.id) });
    }
    await courses.saveOrder(courseId, order);
    return touched;
  };

  const summary = async (id: number) => {
    const tree = (await courses.getTree(id, { drafts: true }))!;
    const lessons = tree.modules.flatMap((m) => m.lessons);
    return {
      id: tree.course.id,
      title: tree.course.title,
      slug: tree.course.slug,
      status: tree.course.status,
      access: tree.course.access,
      price: tree.course.access === "paid" ? cs.formatPrice(tree.course.priceCents, tree.course.currency) : null,
      url: urlOf(tree.course.slug),
      admin: `${siteUrl}/admin/classroom/${tree.course.id}/builder`,
      modules: tree.modules.length,
      lessons: lessons.length,
      published_lessons: lessons.filter((l) => l.status === "active").length,
    };
  };

  switch (cmd) {
    case "catalog": {
      const only = rest[0];
      if (only && !isBlockType(only)) return fail(`Unknown block type "${only}".`);
      const describe = (type: keyof typeof BLOCKS) => {
        const def = BLOCKS[type];
        return {
          type,
          label: def.label,
          group: BLOCK_GROUPS[def.group],
          description: def.desc,
          keeps_student_state: !!def.interactive,
          settings: def.controls.map((c) => ({
            key: c.key,
            kind: c.type,
            label: c.label,
            default: c.type === "items" ? undefined : c.default,
            choices: c.choices ? Object.keys(c.choices) : undefined,
            items: c.fields?.map((f: { key: string; type: string; default?: unknown; choices?: Record<string, string> }) => ({ key: f.key, kind: f.type, default: f.default, choices: f.choices ? Object.keys(f.choices) : undefined })),
            help: c.help,
          })),
        };
      };
      if (only) return out(describe(only as keyof typeof BLOCKS));
      return out({
        course: {
          fields: { title: "text", slug: "text", status: cs.COURSE_STATUSES, category: "name, created if new", summary: "short description", image: "{ url }", language: Object.keys(cs.LANGUAGES), access: cs.ACCESS_MODES, price: "major units, e.g. 800", currency: CURRENCIES },
          settings: COURSE_SETTING_KEYS(cs),
        },
        blocks: (Object.keys(BLOCKS) as (keyof typeof BLOCKS)[]).map(describe),
      });
    }
    case "settings": {
      const s = await getSettings();
      return out({ signup_open: !!s.signup_open, currency: s.currency, bank_details_set: bankConfigured(s), bunny_library_id: s.bunny_library_id || null, bunny_token_key_saved: await hasBunnyKey().catch(() => false), notify_to: s.notify_to || null });
    }
    case "categories":
      return out(await courses.listCategories());
    case "list":
      return out((await courses.listCourses({ q: opt("q") ?? "", status: opt("status") ?? "" })).map((c) => ({ id: c.id, title: c.title, slug: c.slug, status: c.status, access: c.access, url: urlOf(c.slug), modules: c.modules, lessons: c.lessons, students: c.students, pending: c.pending, updated: c.updatedAt })));
    case "get": {
      const course = await find(rest[0]);
      const tree = (await courses.getTree(course.id, { drafts: true }))!;
      const withBlocks = flag("blocks");
      const issues: string[] = [];
      const modules = [];
      for (const m of tree.modules) {
        const lessons = [];
        for (const l of m.lessons) {
          const full = (await courses.getLesson(l.id))!;
          for (const i of brandIssues(full)) if (i.level === "warn") issues.push(`${m.title} / ${l.title}: ${i.message}`);
          lessons.push({ id: l.id, title: l.title, slug: l.slug, status: l.status, preview: l.preview, minutes: l.minutes, blocks: withBlocks ? full.blocks.map((b) => ({ id: b.id, type: b.type, settings: b.settings })) : full.blocks.map((b) => b.type) });
        }
        modules.push({ id: m.id, title: m.title, slug: m.slug, summary: m.summary, lessons });
      }
      return out({ course: { ...courses.publicCourse(course), url: urlOf(course.slug) }, modules, issues });
    }
    case "validate": {
      const spec = readSpec(rest[0]);
      const a = await analyze(spec);
      return out({ ok: a.problems.length === 0 && a.issues.length === 0, ...a });
    }
    case "create": {
      const spec = readSpec(rest[0]);
      const a = await analyze(spec);
      if (a.problems.some((p) => !p.endsWith("is ignored"))) return fail(a.problems.filter((p) => !p.endsWith("is ignored")).join("; "));
      const id = await courses.createCourse({ title: spec.title as string, slug: spec.slug, template: "empty" }, null);
      const fields = strip(await courseFields(spec));
      const saved = await courses.saveCourse(id, fields);
      if (!saved.ok) return fail(saved.error);
      await applyModules(id, spec, false);
      const status = flag("publish") ? "active" : spec.status;
      if (status) {
        const res = await courses.saveCourse(id, { status });
        if (!res.ok) return fail(res.error);
      }
      const s = await summary(id);
      return out({ ...s, brand_warnings: a.issues, notes: a.problems, ...(s.status === "active" ? await refresh() : {}) });
    }
    case "update": {
      const course = await find(rest[0]);
      const spec = readSpec(rest[1]);
      if (flag("prune") && !flag("yes")) return fail("--prune deletes modules and lessons (and their students' progress) that are not in the spec. Add --yes to confirm.");
      const a = await analyze({ ...spec, title: spec.title ?? course.title });
      if (a.problems.some((p) => !p.endsWith("is ignored"))) return fail(a.problems.filter((p) => !p.endsWith("is ignored")).join("; "));
      const fields = strip(await courseFields(spec));
      if (spec.slug) Object.assign(fields, { slug: spec.slug });
      if (spec.status) Object.assign(fields, { status: spec.status });
      if (Object.keys(fields).length) {
        const res = await courses.saveCourse(course.id, fields);
        if (!res.ok) return fail(res.error);
      }
      const touched = spec.modules ? await applyModules(course.id, spec, flag("prune")) : null;
      const s = await summary(course.id);
      return out({ ...s, changed: touched, brand_warnings: a.issues, notes: a.problems, ...(s.status === "active" ? await refresh() : {}) });
    }
    case "status": {
      const course = await find(rest[0]);
      const res = await courses.saveCourse(course.id, { status: rest[1] });
      if (!res.ok) return fail(res.error);
      const s = await summary(course.id);
      return out({ ...s, ...(await refresh()) });
    }
    case "stats": {
      if (!rest[0]) return out(await stats.libraryStats(opt("days")));
      const course = await find(rest[0]);
      return out(await stats.courseStats(course.id, opt("days")));
    }
    case "students": {
      const course = rest[0] ? await find(rest[0]) : null;
      return out((await access.listEnrolments({ courseId: course?.id, status: opt("status") })).map((e) => ({ enrolment: e.id, student: e.userName || e.userEmail, email: e.userEmail, role: e.userRole, course: e.courseTitle, status: e.status, reference: e.status === "pending" ? e.reference : undefined, amount: e.amountCents ? cs.formatPrice(e.amountCents, e.currency) : "Free", paid_at: e.paidAt, progress: `${e.completed}/${e.lessons}`, note: e.note || undefined })));
    }
    case "enrol": {
      const course = await find(rest[0]);
      const email = (rest[1] ?? "").toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Give a valid email address.");
      let user = await getUserByEmail(email);
      const created = !user;
      if (!user) user = await createUser({ email, name: opt("name") ?? "", role: "student", password: null });
      if (user.status !== "active") return fail("This account is disabled. Enable it in Admin > Users first.");
      const e = await access.adminEnrol(user.id, course, { paid: flag("paid"), note: opt("note") });
      return out({ enrolment: e.id, student: email, created_account: created, role: user.role, course: course.title, status: e.status, paid_at: e.paidAt });
    }
    case "confirm": {
      const e = await access.setEnrolment(Number(rest[0]), { status: "active" });
      return e ? out({ enrolment: e.id, status: e.status, paid_at: e.paidAt }) : fail(`No enrolment "${rest[0]}".`);
    }
    case "delete": {
      const course = await find(rest[0]);
      if (!flag("yes")) return fail(`This deletes "${course.title}" with its modules, lessons, enrolments, progress, notes and comments. Add --yes to confirm.`);
      await courses.deleteCourse(course.id);
      return out({ deleted: course.id, ...(await refresh()) });
    }
    case "refresh":
      return out(await refresh());
    default:
      console.error(readFileSync(new URL(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
      process.exit(cmd ? 1 : 0);
  }
}

function COURSE_SETTING_KEYS(cs: typeof import("../src/modules/classroom/lib/course-settings")) {
  return cs.COURSE_CONTROLS.map((c) => ({ key: c.key, kind: c.type, default: c.type === "image" ? undefined : c.default, choices: c.choices ? Object.keys(c.choices) : undefined, label: c.label }));
}

main().then(
  () => process.exit(0),
  (e) => fail(e instanceof Error ? e.message : String(e)),
);
