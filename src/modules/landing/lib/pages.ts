// Landing pages and their blocks: storage and rules. Mirrors modules/forms/lib/forms.ts.
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { schema } from "@/db";
import { db, rowsOf } from "@/db/use";
import { cleanSlug, cleanText } from "@/modules/forms/lib/sanitize";
import { isLandingBlockType, landingWithDefaults, sanitizeLandingBlock, type LandingBlock, type Settings } from "./blocks";
import { PAGE_STATUSES, sanitizeLandingSettings, type LandingSettings, type PageStatus } from "./settings";
import { TEMPLATES } from "./templates";

const { landingPages: pages, landingBlocks: blocksTable, landingRevisions: revisions, landingForms: pageForms } = schema;

export type LandingPage = {
  id: number;
  title: string;
  slug: string;
  status: PageStatus;
  settings: LandingSettings;
  publishedAt: Date | null;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function hydrate(row: typeof pages.$inferSelect): LandingPage {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: (PAGE_STATUSES as readonly string[]).includes(row.status) ? (row.status as PageStatus) : "draft",
    settings: sanitizeLandingSettings(row.settings),
    publishedAt: row.publishedAt,
    authorId: row.authorId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getPage(id: number): Promise<LandingPage | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const [row] = await db().select().from(pages).where(eq(pages.id, id)).limit(1);
  return row ? hydrate(row) : null;
}

export async function getPageBySlug(slug: string): Promise<LandingPage | null> {
  const clean = cleanSlug(slug);
  if (!clean) return null;
  const [row] = await db().select().from(pages).where(eq(pages.slug, clean)).limit(1);
  return row ? hydrate(row) : null;
}

/** A page by its number or its address, whichever the caller has. */
export async function findPage(ref: string | number): Promise<LandingPage | null> {
  const n = Number(ref);
  return Number.isInteger(n) && n > 0 ? getPage(n) : getPageBySlug(String(ref));
}

export type PageListItem = LandingPage & { views: number; unique: number; clicks: number };

export async function listPages(search = ""): Promise<PageListItem[]> {
  const like = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const res = await db().execute(sql`
    SELECT p.id, p.title, p.slug, p.status, p.settings, p.published_at, p.author_id, p.created_at, p.updated_at,
      (SELECT COUNT(*) FROM landing_views v WHERE v.page_id = p.id)::int AS views,
      (SELECT COUNT(DISTINCT v.visitor_id) FROM landing_views v WHERE v.page_id = p.id)::int AS uniq,
      (SELECT COUNT(*) FROM landing_clicks c WHERE c.page_id = p.id)::int AS clicks
    FROM landing_pages p
    ${search ? sql`WHERE p.title ILIKE ${like} OR p.slug ILIKE ${like}` : sql``}
    ORDER BY p.updated_at DESC`);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({
    id: Number(r.id),
    title: String(r.title),
    slug: String(r.slug),
    status: (PAGE_STATUSES as readonly string[]).includes(String(r.status)) ? (r.status as PageStatus) : "draft",
    settings: sanitizeLandingSettings(r.settings),
    publishedAt: r.published_at ? new Date(r.published_at as string) : null,
    authorId: (r.author_id as string | null) ?? null,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
    views: Number(r.views),
    unique: Number(r.uniq),
    clicks: Number(r.clicks),
  }));
}

/** Published pages that allow search engines: these go into the sitemap. */
export async function indexablePages(): Promise<{ slug: string; updatedAt: Date }[]> {
  const rows = await db().select().from(pages).where(eq(pages.status, "published"));
  return rows.map(hydrate).filter((p) => p.settings.indexable).map((p) => ({ slug: p.slug, updatedAt: p.updatedAt }));
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                     */
/* -------------------------------------------------------------------------- */

export async function getBlocks(pageId: number): Promise<LandingBlock[]> {
  const rows = await db().select().from(blocksTable).where(eq(blocksTable.pageId, pageId)).orderBy(asc(blocksTable.position), asc(blocksTable.id));
  const out: LandingBlock[] = [];
  for (const r of rows) {
    if (!isLandingBlockType(r.type)) continue;
    out.push({ id: r.id, type: r.type, settings: landingWithDefaults(r.type, r.settings) });
  }
  return out;
}

export type BlockInput = { id?: number; type: string; settings?: unknown };

/** Persists the full ordered list of blocks: inserts, updates and deletes. Returns the saved blocks. */
export async function saveBlocks(pageId: number, input: BlockInput[]): Promise<LandingBlock[]> {
  const d = db();
  const existing = new Set((await d.select({ id: blocksTable.id }).from(blocksTable).where(eq(blocksTable.pageId, pageId))).map((r) => r.id));
  const keep: number[] = [];
  let pos = 0;
  for (const b of input.slice(0, 120)) {
    const type = String(b.type ?? "");
    if (!isLandingBlockType(type)) continue;
    const row = { pageId, position: pos++, type, settings: sanitizeLandingBlock(type, b.settings) };
    const id = typeof b.id === "number" ? b.id : 0;
    if (id && existing.has(id)) {
      await d.update(blocksTable).set(row).where(eq(blocksTable.id, id));
      keep.push(id);
    } else {
      const [ins] = await d.insert(blocksTable).values(row).returning({ id: blocksTable.id });
      keep.push(ins.id);
    }
  }
  const remove = [...existing].filter((id) => !keep.includes(id));
  if (remove.length) await d.delete(blocksTable).where(inArray(blocksTable.id, remove));
  const saved = await getBlocks(pageId);
  await syncForms(pageId, saved);
  return saved;
}

/** Records which forms the page embeds, so a form can tell where it is used. */
async function syncForms(pageId: number, blocks: LandingBlock[]) {
  const wanted = [...new Set(blocks.filter((b) => b.type === "form").map((b) => Number(b.settings.form_id)).filter((n) => n > 0))];
  const d = db();
  const valid = wanted.length ? (await d.select({ id: schema.bbformsForms.id }).from(schema.bbformsForms).where(inArray(schema.bbformsForms.id, wanted))).map((r) => r.id) : [];
  await d.delete(pageForms).where(eq(pageForms.pageId, pageId));
  if (valid.length) await d.insert(pageForms).values(valid.map((formId) => ({ pageId, formId })));
}

export async function formsUsedBy(pageId: number): Promise<number[]> {
  return (await db().select({ formId: pageForms.formId }).from(pageForms).where(eq(pageForms.pageId, pageId))).map((r) => r.formId);
}

/** Landing pages that embed a given form. */
export async function pagesUsingForm(formId: number): Promise<{ id: number; title: string; slug: string }[]> {
  const res = await db().execute(sql`SELECT p.id, p.title, p.slug FROM landing_forms f JOIN landing_pages p ON p.id = f.page_id WHERE f.form_id = ${formId} ORDER BY p.title`);
  return rowsOf<{ id: number; title: string; slug: string }>(res).map((r) => ({ id: Number(r.id), title: String(r.title), slug: String(r.slug) }));
}

/* -------------------------------------------------------------------------- */
/* Pages                                                                      */
/* -------------------------------------------------------------------------- */

async function uniqueSlug(base: string, exceptId = 0): Promise<string> {
  const root = cleanSlug(base).slice(0, 70) || "page";
  let slug = root;
  for (let i = 2; i < 200; i++) {
    const [taken] = await db().select({ id: pages.id }).from(pages).where(eq(pages.slug, slug)).limit(1);
    if (!taken || taken.id === exceptId) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

export async function createPage(opts: { title: string; slug?: string; template?: string; settings?: unknown }, authorId: string | null): Promise<number> {
  const title = cleanText(opts.title, 255) || "Untitled page";
  const slug = await uniqueSlug(opts.slug || title);
  const tpl = TEMPLATES[opts.template ?? "blank"];
  const [row] = await db()
    .insert(pages)
    .values({ title, slug, status: "draft", settings: sanitizeLandingSettings({ ...(tpl?.settings ?? {}), ...((opts.settings as object) ?? {}) }), authorId })
    .returning({ id: pages.id });
  if (tpl?.blocks.length) await saveBlocks(row.id, tpl.blocks.map(([type, settings]) => ({ type, settings: settings ?? {} })));
  return row.id;
}

export type SaveInput = { title?: string; slug?: string; status?: string; settings?: unknown; blocks?: BlockInput[]; label?: string };
export type SaveResult = { ok: true; page: LandingPage; blocks: LandingBlock[] } | { ok: false; error: string };

/** One call saves everything the builder or the CLI changed, then keeps a snapshot for undo. */
export async function savePage(id: number, input: SaveInput, authorId: string | null): Promise<SaveResult> {
  const before = await getPage(id);
  if (!before) return { ok: false, error: "Page not found." };
  const set: Partial<typeof pages.$inferInsert> = { updatedAt: new Date() };
  if (input.title !== undefined) set.title = cleanText(input.title, 255) || "Untitled page";
  if (input.slug !== undefined) {
    const slug = cleanSlug(input.slug);
    if (slug.length < 2) return { ok: false, error: "The page address needs at least two letters or numbers." };
    const [taken] = await db().select({ id: pages.id }).from(pages).where(eq(pages.slug, slug)).limit(1);
    if (taken && taken.id !== id) return { ok: false, error: `The address /l/${slug} is already used by another page.` };
    set.slug = slug;
  }
  if (input.status !== undefined) {
    if (!(PAGE_STATUSES as readonly string[]).includes(input.status)) return { ok: false, error: "Unknown status." };
    set.status = input.status;
    if (input.status === "published" && !before.publishedAt) set.publishedAt = new Date();
  }
  if (input.settings !== undefined) set.settings = sanitizeLandingSettings(input.settings, before.settings);
  await db().update(pages).set(set).where(eq(pages.id, id));
  const blocks = Array.isArray(input.blocks) ? await saveBlocks(id, input.blocks) : await getBlocks(id);
  const page = (await getPage(id)) as LandingPage;
  await snapshot(page, blocks, authorId, input.label ?? "");
  return { ok: true, page, blocks };
}

const KEEP_REVISIONS = 30;

async function snapshot(page: LandingPage, blocks: LandingBlock[], authorId: string | null, label: string) {
  const d = db();
  await d.insert(revisions).values({
    pageId: page.id,
    authorId,
    label: cleanText(label, 120),
    snapshot: { title: page.title, slug: page.slug, status: page.status, settings: page.settings, blocks: blocks.map((b) => ({ type: b.type, settings: b.settings })) },
  });
  const old = await d.select({ id: revisions.id }).from(revisions).where(eq(revisions.pageId, page.id)).orderBy(desc(revisions.createdAt), desc(revisions.id)).offset(KEEP_REVISIONS);
  if (old.length) await d.delete(revisions).where(inArray(revisions.id, old.map((r) => r.id)));
}

export async function listRevisions(pageId: number) {
  const rows = await db().select({ id: revisions.id, label: revisions.label, createdAt: revisions.createdAt, authorId: revisions.authorId, snapshot: revisions.snapshot }).from(revisions).where(eq(revisions.pageId, pageId)).orderBy(desc(revisions.createdAt), desc(revisions.id));
  return rows.map((r) => ({ id: r.id, label: r.label, createdAt: r.createdAt, authorId: r.authorId, blocks: ((r.snapshot as { blocks?: unknown[] })?.blocks ?? []).length }));
}

/** Puts a snapshot back as the page content (title, settings and blocks; the address and status stay). */
export async function restoreRevision(pageId: number, revisionId: number, authorId: string | null): Promise<SaveResult> {
  const [rev] = await db().select().from(revisions).where(eq(revisions.id, revisionId)).limit(1);
  if (!rev || rev.pageId !== pageId) return { ok: false, error: "Revision not found." };
  const snap = rev.snapshot as { title?: string; settings?: unknown; blocks?: BlockInput[] };
  return savePage(pageId, { title: snap.title, settings: snap.settings, blocks: snap.blocks, label: `Restored #${revisionId}` }, authorId);
}

export async function deletePage(id: number): Promise<void> {
  // Blocks, revisions, views, clicks and form links go with it (ON DELETE CASCADE).
  await db().delete(pages).where(eq(pages.id, id));
}

export async function duplicatePage(id: number, authorId: string | null): Promise<number> {
  const page = await getPage(id);
  if (!page) return 0;
  const newId = await createPage({ title: `${page.title} (copy)`, slug: `${page.slug}-copy`, settings: page.settings }, authorId);
  await saveBlocks(newId, (await getBlocks(id)).map((b) => ({ type: b.type, settings: b.settings })));
  return newId;
}

export function blocksToInput(blocks: LandingBlock[]): BlockInput[] {
  return blocks.map((b) => ({ id: b.id, type: b.type, settings: b.settings as Settings }));
}
