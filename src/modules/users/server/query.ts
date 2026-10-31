// Reads for the Users screens: the filtered, sorted, paged list, the ids behind a selection, filter options and tags.
import { sql, type SQL } from "drizzle-orm";
import { db, rowsOf } from "@/db/use";
import type { ListParams, Scope, UserFilter } from "../lib/filter";

const esc = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const idList = (ids: (string | number)[], cast: "uuid" | "int") => sql.join(ids.map((i) => sql`${i}::${sql.raw(cast)}`), sql`, `);

/** The WHERE of a filter, on the table alias `u`. Every value is a bound parameter. */
export function whereOf(f: UserFilter): SQL {
  const c: SQL[] = [];
  if (f.q) {
    const like = `%${esc(f.q)}%`;
    c.push(sql`(u.email ILIKE ${like} OR u.name ILIKE ${like} OR u.username ILIKE ${like} OR u.company ILIKE ${like} OR u.phone ILIKE ${like} OR u.job_title ILIKE ${like})`);
  }
  if (f.role) c.push(sql`u.role = ${f.role}`);
  if (f.status) c.push(sql`u.status = ${f.status}`);
  if (f.signin === "never") c.push(sql`u.last_login_at IS NULL`);
  if (f.signin === "30") c.push(sql`u.last_login_at > now() - interval '30 days'`);
  if (f.signin === "90") c.push(sql`u.last_login_at > now() - interval '90 days'`);
  if (f.signin === "stale") c.push(sql`(u.last_login_at IS NULL OR u.last_login_at < now() - interval '90 days')`);
  if (f.pw === "yes") c.push(sql`u.password_hash IS NOT NULL`);
  if (f.pw === "no") c.push(sql`u.password_hash IS NULL`);
  if (f.country) c.push(sql`u.country ILIKE ${`%${esc(f.country)}%`}`);
  if (f.course) c.push(sql`EXISTS (SELECT 1 FROM classroom_enrolments e WHERE e.user_id = u.id AND e.course_id = ${f.course} ${f.courseStatus ? sql`AND e.status = ${f.courseStatus}` : sql``})`);
  if (f.notCourse) c.push(sql`NOT EXISTS (SELECT 1 FROM classroom_enrolments e WHERE e.user_id = u.id AND e.course_id = ${f.notCourse} AND e.status <> 'revoked')`);
  if (f.community) c.push(sql`EXISTS (SELECT 1 FROM community_members m WHERE m.user_id = u.id AND m.community_id = ${f.community} AND m.status = 'active')`);
  if (f.notCommunity) c.push(sql`NOT EXISTS (SELECT 1 FROM community_members m WHERE m.user_id = u.id AND m.community_id = ${f.notCommunity} AND m.status = 'active')`);
  if (f.tag?.length) c.push(sql`EXISTS (SELECT 1 FROM user_tag_members t WHERE t.user_id = u.id AND t.tag_id IN (${idList(f.tag, "int")}))`);
  if (f.notTag) c.push(sql`NOT EXISTS (SELECT 1 FROM user_tag_members t WHERE t.user_id = u.id AND t.tag_id = ${f.notTag})`);
  if (f.untagged) c.push(sql`NOT EXISTS (SELECT 1 FROM user_tag_members t WHERE t.user_id = u.id)`);
  if (f.from) c.push(sql`u.created_at >= ${f.from}::date`);
  if (f.to) c.push(sql`u.created_at < (${f.to}::date + 1)`);
  return c.length ? sql`WHERE ${sql.join(c, sql` AND `)}` : sql``;
}

const COURSES_N = sql`(SELECT count(*)::int FROM classroom_enrolments e WHERE e.user_id = u.id AND e.status = 'active')`;
const COMMUNITIES_N = sql`(SELECT count(*)::int FROM community_members m WHERE m.user_id = u.id AND m.status = 'active')`;
const TAGS_JSON = sql`(SELECT coalesce(json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name), '[]'::json) FROM user_tag_members x JOIN user_tags t ON t.id = x.tag_id WHERE x.user_id = u.id)`;

const ORDER: Record<ListParams["sort"], SQL> = {
  name: sql`lower(coalesce(nullif(u.name, ''), u.email))`,
  email: sql`u.email`,
  role: sql`u.role`,
  status: sql`u.status`,
  created: sql`u.created_at`,
  login: sql`u.last_login_at`,
  courses: COURSES_N,
  communities: COMMUNITIES_N,
};

export type UserListRow = {
  id: string;
  email: string;
  name: string;
  username: string | null;
  role: string;
  status: string;
  company: string | null;
  country: string | null;
  hasPassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  courses: number;
  communities: number;
  tags: { id: number; name: string }[];
};

const asJson = <T>(v: unknown, fallback: T): T => {
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return (v ?? fallback) as T;
};
const iso = (v: unknown) => (v ? (v instanceof Date ? v : new Date(String(v))).toISOString() : null);

export async function listUsersPage(p: ListParams): Promise<{ rows: UserListRow[]; total: number; page: number; pages: number }> {
  const where = whereOf(p.filter);
  const [{ n }] = rowsOf<{ n: number }>(await db().execute(sql`SELECT count(*)::int AS n FROM users u ${where}`));
  const pages = Math.max(1, Math.ceil(n / p.perPage));
  const page = Math.min(p.page, pages);
  const dir = p.dir === "asc" ? sql`ASC` : sql`DESC`;
  const res = rowsOf<Record<string, unknown>>(
    await db().execute(sql`
      SELECT u.id, u.email, u.name, u.username, u.role, u.status, u.company, u.country, (u.password_hash IS NOT NULL) AS has_password, u.last_login_at, u.created_at,
             ${COURSES_N} AS courses, ${COMMUNITIES_N} AS communities, ${TAGS_JSON} AS tags
      FROM users u ${where}
      ORDER BY ${ORDER[p.sort]} ${dir} NULLS LAST, u.created_at DESC, u.id
      LIMIT ${p.perPage} OFFSET ${(page - 1) * p.perPage}`),
  );
  const rows = res.map((r) => ({
    id: String(r.id),
    email: String(r.email),
    name: String(r.name ?? ""),
    username: (r.username as string | null) ?? null,
    role: String(r.role),
    status: String(r.status),
    company: (r.company as string | null) ?? null,
    country: (r.country as string | null) ?? null,
    hasPassword: !!r.has_password,
    lastLoginAt: iso(r.last_login_at),
    createdAt: iso(r.created_at) as string,
    courses: Number(r.courses),
    communities: Number(r.communities),
    tags: asJson<{ id: number; name: string }[]>(r.tags, []),
  }));
  return { rows, total: n, page, pages };
}

export const MAX_BULK = 20000;

/** The user ids behind a selection: the ticked ones, or everyone a filter matches on every page. */
export async function resolveScope(scope: Scope): Promise<string[]> {
  if ("ids" in scope) return scope.ids.slice(0, MAX_BULK);
  return rowsOf<{ id: string }>(await db().execute(sql`SELECT u.id FROM users u ${whereOf(scope.filter)} ORDER BY u.created_at LIMIT ${MAX_BULK}`)).map((r) => String(r.id));
}

export async function countMatching(f: UserFilter): Promise<number> {
  const [{ n }] = rowsOf<{ n: number }>(await db().execute(sql`SELECT count(*)::int AS n FROM users u ${whereOf(f)}`));
  return n;
}

// ---- options for the filter bar and pickers

export type Option = { id: number; label: string; extra?: string };
export type FilterOptions = { courses: Option[]; communities: Option[]; tags: (Option & { count: number })[]; countries: string[] };

export async function filterOptions(): Promise<FilterOptions> {
  const [courses, communities, tags, countries] = await Promise.all([
    db().execute(sql`SELECT id, title AS label, access AS extra FROM classroom_courses ORDER BY title`),
    db().execute(sql`SELECT id, name AS label, status AS extra FROM community_communities ORDER BY sort_order, name`),
    db().execute(sql`SELECT t.id, t.name AS label, (SELECT count(*)::int FROM user_tag_members m WHERE m.tag_id = t.id) AS count FROM user_tags t ORDER BY lower(t.name)`),
    db().execute(sql`SELECT DISTINCT country FROM users WHERE country IS NOT NULL AND country <> '' ORDER BY country LIMIT 300`),
  ]);
  const opt = (r: Record<string, unknown>): Option => ({ id: Number(r.id), label: String(r.label), extra: r.extra ? String(r.extra) : undefined });
  return {
    courses: rowsOf<Record<string, unknown>>(courses).map(opt),
    communities: rowsOf<Record<string, unknown>>(communities).map(opt),
    tags: rowsOf<Record<string, unknown>>(tags).map((r) => ({ ...opt(r), count: Number(r.count) })),
    countries: rowsOf<{ country: string }>(countries).map((r) => r.country),
  };
}

// ---- tags

export type TagRow = { id: number; name: string; slug: string; description: string; members: number; createdAt: string };

export async function listTags(): Promise<TagRow[]> {
  const res = rowsOf<Record<string, unknown>>(
    await db().execute(sql`SELECT t.id, t.name, t.slug, t.description, t.created_at, (SELECT count(*)::int FROM user_tag_members m WHERE m.tag_id = t.id) AS members FROM user_tags t ORDER BY lower(t.name)`),
  );
  return res.map((r) => ({ id: Number(r.id), name: String(r.name), slug: String(r.slug), description: String(r.description ?? ""), members: Number(r.members), createdAt: iso(r.created_at) as string }));
}

export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/** Finds a tag by name (case-insensitive) or creates it. */
export async function ensureTag(name: string, createdBy: string | null): Promise<{ id: number; name: string; created: boolean }> {
  const clean = name.replace(/\s+/g, " ").trim().slice(0, 60);
  const slug = slugify(clean);
  if (!clean || !slug) throw new Error("Give the tag a name.");
  const [existing] = rowsOf<{ id: number; name: string }>(await db().execute(sql`SELECT id, name FROM user_tags WHERE slug = ${slug}`));
  if (existing) return { id: Number(existing.id), name: existing.name, created: false };
  const [row] = rowsOf<{ id: number }>(await db().execute(sql`INSERT INTO user_tags (name, slug, created_by) VALUES (${clean}, ${slug}, ${createdBy}) ON CONFLICT (slug) DO UPDATE SET slug = excluded.slug RETURNING id`));
  return { id: Number(row.id), name: clean, created: true };
}

// ---- one user

export type UserDetail = {
  user: {
    id: string; email: string; name: string; username: string; phone: string; company: string; jobTitle: string; country: string; timezone: string; bio: string;
    role: string; status: string; hasPassword: boolean; failedAttempts: number; lockedUntil: string | null; lastLoginAt: string | null; createdAt: string; updatedAt: string; avatarUrl: string | null;
  };
  enrolments: { id: number; courseId: number; title: string; status: string; source: string; createdAt: string; completed: number; lessons: number }[];
  memberships: { communityId: number; name: string; role: string; status: string; joinedAt: string }[];
  tags: { id: number; name: string }[];
};

export async function getUserDetail(id: string): Promise<UserDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [u] = rowsOf<Record<string, unknown>>(await db().execute(sql`SELECT * FROM users WHERE id = ${id}::uuid`));
  if (!u) return null;
  const [en, mem, tg] = await Promise.all([
    db().execute(sql`
      SELECT e.id, e.course_id, c.title, e.status, e.source, e.created_at,
        (SELECT count(*)::int FROM classroom_progress p WHERE p.user_id = e.user_id AND p.course_id = e.course_id AND p.completed_at IS NOT NULL) AS completed,
        (SELECT count(*)::int FROM classroom_lessons l WHERE l.course_id = e.course_id AND l.status = 'active') AS lessons
      FROM classroom_enrolments e JOIN classroom_courses c ON c.id = e.course_id WHERE e.user_id = ${id}::uuid ORDER BY e.created_at DESC`),
    db().execute(sql`SELECT m.community_id, c.name, m.role, m.status, m.joined_at FROM community_members m JOIN community_communities c ON c.id = m.community_id WHERE m.user_id = ${id}::uuid ORDER BY c.sort_order, c.name`),
    db().execute(sql`SELECT t.id, t.name FROM user_tag_members x JOIN user_tags t ON t.id = x.tag_id WHERE x.user_id = ${id}::uuid ORDER BY lower(t.name)`),
  ]);
  const s = (k: string) => (u[k] == null ? "" : String(u[k]));
  return {
    user: {
      id: s("id"), email: s("email"), name: s("name"), username: s("username"), phone: s("phone"), company: s("company"), jobTitle: s("job_title"), country: s("country"), timezone: s("timezone"), bio: s("bio"),
      role: s("role"), status: s("status"), hasPassword: !!u.password_hash, failedAttempts: Number(u.failed_attempts ?? 0), lockedUntil: iso(u.locked_until), lastLoginAt: iso(u.last_login_at),
      createdAt: iso(u.created_at) as string, updatedAt: iso(u.updated_at) as string, avatarUrl: (u.avatar_url as string | null) ?? null,
    },
    enrolments: rowsOf<Record<string, unknown>>(en).map((r) => ({ id: Number(r.id), courseId: Number(r.course_id), title: String(r.title), status: String(r.status), source: String(r.source), createdAt: iso(r.created_at) as string, completed: Number(r.completed), lessons: Number(r.lessons) })),
    memberships: rowsOf<Record<string, unknown>>(mem).map((r) => ({ communityId: Number(r.community_id), name: String(r.name), role: String(r.role), status: String(r.status), joinedAt: iso(r.joined_at) as string })),
    tags: rowsOf<{ id: number; name: string }>(tg).map((r) => ({ id: Number(r.id), name: r.name })),
  };
}
