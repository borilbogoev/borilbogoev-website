// Categories inside a community: tabs in its feed.
import { and, asc, eq } from "drizzle-orm";
import { schema } from "@/db";
import { SORT_RULES, type SortRule } from "../lib/constants";
import { db, invalid, notFound, unwrap } from "./core";
import { getCommunityById, type Viewer } from "./context";
import { log } from "./audit";
import { canManageCommunities } from "./permissions";

const { communityCategories: K } = schema;

export type CategoryDTO = { id: number; communityId: number; name: string; slug: string; status: "draft" | "published"; sortRule: SortRule; position: number };

const toDTO = (r: typeof K.$inferSelect): CategoryDTO => ({
  id: r.id,
  communityId: r.communityId,
  name: r.name,
  slug: r.slug,
  status: r.status === "published" ? "published" : "draft",
  sortRule: (SORT_RULES as readonly string[]).includes(r.sortRule) ? (r.sortRule as SortRule) : "default",
  position: r.position,
});

/** Categories of a community. Members only ever see the published ones. */
export async function listCategories(communityId: number, opts: { all?: boolean } = {}): Promise<CategoryDTO[]> {
  const rows = await db().select().from(K).where(and(eq(K.communityId, communityId), opts.all ? undefined : eq(K.status, "published"))).orderBy(asc(K.position), asc(K.id));
  return rows.map(toDTO);
}

export async function getCategory(id: number): Promise<CategoryDTO | null> {
  const [r] = await db().select().from(K).where(eq(K.id, id)).limit(1);
  return r ? toDTO(r) : null;
}

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "category";

export type CategoryInput = { name?: unknown; status?: unknown; sortRule?: unknown };

export async function createCategory(viewer: Viewer, communityId: number, input: CategoryInput): Promise<CategoryDTO> {
  unwrap(canManageCommunities(viewer.actor));
  if (!(await getCommunityById(communityId))) throw notFound();
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 40) : "";
  if (!name) throw invalid("Give the category a name.");
  const existing = await db().select({ slug: K.slug, pos: K.position }).from(K).where(eq(K.communityId, communityId));
  const taken = new Set(existing.map((e) => e.slug));
  let slug = slugify(name);
  for (let n = 2; taken.has(slug); n++) slug = `${slugify(name)}-${n}`;
  const [row] = await db()
    .insert(K)
    .values({
      communityId,
      name,
      slug,
      status: input.status === "published" ? "published" : "draft",
      sortRule: (SORT_RULES as readonly string[]).includes(input.sortRule as string) ? (input.sortRule as string) : "default",
      position: existing.reduce((m, e) => Math.max(m, e.pos + 1), 0),
    })
    .returning();
  await log(viewer.user.id, "category.create", "category", row.id, { communityId, name });
  return toDTO(row);
}

export async function updateCategory(viewer: Viewer, id: number, input: CategoryInput): Promise<CategoryDTO> {
  unwrap(canManageCommunities(viewer.actor));
  const cur = await getCategory(id);
  if (!cur) throw notFound();
  const set: Partial<typeof K.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    const name = typeof input.name === "string" ? input.name.trim().slice(0, 40) : "";
    if (!name) throw invalid("Give the category a name.");
    set.name = name;
  }
  if (input.status !== undefined) set.status = input.status === "published" ? "published" : "draft";
  if (input.sortRule !== undefined && (SORT_RULES as readonly string[]).includes(input.sortRule as string)) set.sortRule = input.sortRule as string;
  const [row] = await db().update(K).set(set).where(eq(K.id, id)).returning();
  await log(viewer.user.id, "category.update", "category", id, { fields: Object.keys(set).filter((k) => k !== "updatedAt") });
  return toDTO(row);
}

/** Posts in a deleted category stay and lose the category (foreign key: set null). */
export async function deleteCategory(viewer: Viewer, id: number) {
  unwrap(canManageCommunities(viewer.actor));
  const cur = await getCategory(id);
  if (!cur) throw notFound();
  await db().delete(K).where(eq(K.id, id));
  await log(viewer.user.id, "category.delete", "category", id, { name: cur.name });
}

export async function reorderCategories(viewer: Viewer, communityId: number, ids: number[]) {
  unwrap(canManageCommunities(viewer.actor));
  for (const [i, id] of ids.entries()) await db().update(K).set({ position: i }).where(and(eq(K.id, id), eq(K.communityId, communityId)));
}

