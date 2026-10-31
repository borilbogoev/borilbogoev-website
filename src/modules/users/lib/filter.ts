// The filter of the Users list, shared by the page, the browser and the API. Pure: no database here.
// It lives in the URL (?q=...&role=...), so a filtered list can be bookmarked, and the same object selects "everyone matching" for a bulk action.

export const SIGNIN_CHOICES = { never: "Never signed in", "30": "Signed in, last 30 days", "90": "Signed in, last 90 days", stale: "No sign-in for 90 days" } as const;
export const PASSWORD_CHOICES = { yes: "Has a password", no: "Google only (no password)" } as const;
export const COURSE_STATUS_CHOICES = { active: "Active", pending: "Pending payment", revoked: "Access removed" } as const;

export type UserFilter = {
  q?: string; // name, email, username, company, phone
  role?: string;
  status?: "active" | "disabled";
  signin?: keyof typeof SIGNIN_CHOICES;
  pw?: keyof typeof PASSWORD_CHOICES;
  country?: string;
  course?: number; // enrolled in this course ...
  courseStatus?: keyof typeof COURSE_STATUS_CHOICES; // ... with this enrolment status (any when empty)
  notCourse?: number; // not enrolled (or access removed)
  community?: number; // active member of
  notCommunity?: number;
  tag?: number[]; // has any of these tags
  notTag?: number; // does not have this tag
  untagged?: boolean;
  from?: string; // created on or after, YYYY-MM-DD
  to?: string; // created on or before
};

export const SORTS = ["name", "email", "role", "status", "created", "login", "courses", "communities"] as const;
export type SortKey = (typeof SORTS)[number];
export const PAGE_SIZES = [10, 25, 50, 100, 200] as const;

export type ListParams = { filter: UserFilter; sort: SortKey; dir: "asc" | "desc"; page: number; perPage: number };

type Raw = Record<string, string | string[] | undefined> | URLSearchParams;
const get = (raw: Raw, k: string): string => {
  const v = raw instanceof URLSearchParams ? raw.get(k) : raw[k];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
};
const int = (s: string) => (/^\d{1,9}$/.test(s) ? Number(s) : undefined);
const date = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
const oneOf = <T extends string>(s: string, list: readonly T[]) => (list.includes(s as T) ? (s as T) : undefined);

export function parseFilter(raw: Raw): UserFilter {
  const f: UserFilter = {};
  const q = get(raw, "q").slice(0, 120);
  if (q) f.q = q;
  const role = get(raw, "role");
  if (role) f.role = role.slice(0, 20);
  const status = oneOf(get(raw, "status"), ["active", "disabled"] as const);
  if (status) f.status = status;
  const signin = oneOf(get(raw, "signin"), Object.keys(SIGNIN_CHOICES) as (keyof typeof SIGNIN_CHOICES)[]);
  if (signin) f.signin = signin;
  const pw = oneOf(get(raw, "pw"), ["yes", "no"] as const);
  if (pw) f.pw = pw;
  const country = get(raw, "country").slice(0, 80);
  if (country) f.country = country;
  const course = int(get(raw, "course"));
  if (course) f.course = course;
  const courseStatus = oneOf(get(raw, "courseStatus"), Object.keys(COURSE_STATUS_CHOICES) as (keyof typeof COURSE_STATUS_CHOICES)[]);
  if (courseStatus && course) f.courseStatus = courseStatus;
  const notCourse = int(get(raw, "notCourse"));
  if (notCourse) f.notCourse = notCourse;
  const community = int(get(raw, "community"));
  if (community) f.community = community;
  const notCommunity = int(get(raw, "notCommunity"));
  if (notCommunity) f.notCommunity = notCommunity;
  const tag = get(raw, "tag")
    .split(",")
    .map(int)
    .filter((n): n is number => !!n);
  if (tag.length) f.tag = [...new Set(tag)].slice(0, 50);
  const notTag = int(get(raw, "notTag"));
  if (notTag) f.notTag = notTag;
  if (get(raw, "untagged") === "1") f.untagged = true;
  const from = date(get(raw, "from"));
  if (from) f.from = from;
  const to = date(get(raw, "to"));
  if (to) f.to = to;
  return f;
}

/** The filter as URL parameters (only the ones that are set). */
export function filterToParams(f: UserFilter): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === "" || v === false) continue;
    p.set(k, Array.isArray(v) ? v.join(",") : v === true ? "1" : String(v));
  }
  return p;
}

export const hasFilter = (f: UserFilter) => Object.keys(f).length > 0;

export function parseList(raw: Raw): ListParams {
  const sort = oneOf(get(raw, "sort"), SORTS) ?? "created";
  const dirParam = get(raw, "dir");
  const dir = dirParam === "asc" || dirParam === "desc" ? dirParam : ["name", "email", "role", "status"].includes(sort) ? "asc" : "desc";
  const per = Number(get(raw, "per"));
  const perPage = (PAGE_SIZES as readonly number[]).includes(per) ? per : 25;
  const page = Math.max(1, int(get(raw, "page")) ?? 1);
  return { filter: parseFilter(raw), sort, dir, page, perPage };
}

/** Which people a bulk action or an export applies to: ticked rows, or everyone the filter matches (all pages). */
export type Scope = { ids: string[] } | { filter: UserFilter };

export function parseScope(v: unknown): Scope | null {
  if (!v || typeof v !== "object") return null;
  const s = v as { ids?: unknown; filter?: unknown };
  if (Array.isArray(s.ids)) {
    const ids = [...new Set(s.ids.filter((i): i is string => typeof i === "string" && /^[0-9a-f-]{36}$/i.test(i)))];
    return ids.length ? { ids } : null;
  }
  if (s.filter && typeof s.filter === "object") {
    const p = new URLSearchParams();
    for (const [k, val] of Object.entries(s.filter as Record<string, unknown>)) if (val !== undefined && val !== null) p.set(k, Array.isArray(val) ? val.join(",") : String(val));
    return { filter: parseFilter(p) };
  }
  return null;
}

// ---- export columns

export const EXPORT_COLUMNS = [
  { key: "email", label: "Email", on: true },
  { key: "name", label: "Name", on: true },
  { key: "username", label: "Username", on: false },
  { key: "role", label: "Role", on: true },
  { key: "status", label: "Account status", on: true },
  { key: "phone", label: "Phone", on: false },
  { key: "company", label: "Company", on: false },
  { key: "job_title", label: "Job title", on: false },
  { key: "country", label: "Country", on: false },
  { key: "timezone", label: "Time zone", on: false },
  { key: "bio", label: "Bio", on: false },
  { key: "has_password", label: "Has a password", on: false },
  { key: "last_login", label: "Last sign-in", on: true },
  { key: "created_at", label: "Created", on: true },
  { key: "tags", label: "Tags", on: true },
  { key: "courses", label: "Courses (active)", on: false },
  { key: "communities", label: "Communities", on: false },
  { key: "id", label: "User ID", on: false },
] as const;
export type ExportKey = (typeof EXPORT_COLUMNS)[number]["key"];
export const isExportKey = (k: string): k is ExportKey => EXPORT_COLUMNS.some((c) => c.key === k);
