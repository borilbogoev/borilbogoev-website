// Presentations, slides and elements: storage and rules. Mirrors modules/landing/lib/pages.ts, with one more level (slides)
// and the extras a deck has: categories, tags, a password.
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { schema } from "@/db";
import { db, rowsOf } from "@/db/use";
import { cleanSlug, cleanText } from "@/modules/forms/lib/sanitize";
import { hashDeckPassword, MIN_DECK_PASSWORD } from "./access";
import { elementWithDefaults, isElementType } from "./elements";
import { cleanMode, cleanOrientation, cleanStatus, DECK_STATUSES, sanitizeDeckSettings, type DeckMode, type DeckOrientation, type DeckSettings, type DeckStatus } from "./settings";
import { cleanSlideInput, isSlideKind, newSlide, slideWithDefaults, type DeckSlide, type ElementInput, type SlideInput } from "./slides";
import { DECK_TEMPLATES } from "./templates";

const { presentations: decks, presentationSlides: slidesT, presentationElements: elementsT, presentationRevisions: revisions, presentationForms: deckForms, presentationCategories: categories, presentationTags: tagsT, presentationTagLinks: tagLinks } = schema;

export type Deck = {
  id: number;
  title: string;
  slug: string;
  status: DeckStatus;
  mode: DeckMode;
  orientation: DeckOrientation;
  categoryId: number | null;
  /** Never sent to a browser. Use `publicDeck` for API answers. */
  passwordHash: string | null;
  settings: DeckSettings;
  publishedAt: Date | null;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function hydrate(row: typeof decks.$inferSelect): Deck {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: cleanStatus(row.status) ?? "draft",
    mode: cleanMode(row.mode),
    orientation: cleanOrientation(row.orientation),
    categoryId: row.categoryId,
    passwordHash: row.passwordHash,
    settings: sanitizeDeckSettings(row.settings),
    publishedAt: row.publishedAt,
    authorId: row.authorId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** The deck as an API or a client component may see it: dates as text, the password hash replaced by a flag. */
export function publicDeck(d: Deck) {
  const { passwordHash, publishedAt, createdAt, updatedAt, ...rest } = d;
  return { ...rest, hasPassword: !!passwordHash, publishedAt: publishedAt?.toISOString() ?? null, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() };
}

export async function getDeck(id: number): Promise<Deck | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const [row] = await db().select().from(decks).where(eq(decks.id, id)).limit(1);
  return row ? hydrate(row) : null;
}

export async function getDeckBySlug(slug: string): Promise<Deck | null> {
  const clean = cleanSlug(slug);
  if (!clean) return null;
  const [row] = await db().select().from(decks).where(eq(decks.slug, clean)).limit(1);
  return row ? hydrate(row) : null;
}

/** A deck by its number or its address, whichever the caller has. */
export async function findDeck(ref: string | number): Promise<Deck | null> {
  const n = Number(ref);
  return Number.isInteger(n) && n > 0 ? getDeck(n) : getDeckBySlug(String(ref));
}

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

export type DeckListItem = Omit<Deck, "passwordHash"> & { hasPassword: boolean; categoryName: string; tags: string[]; slides: number; views: number; unique: number; avgReach: number | null };

export type ListFilter = { q?: string; status?: string; category?: number; tag?: string };

export async function listDecks(f: ListFilter = {}): Promise<DeckListItem[]> {
  const like = `%${(f.q ?? "").replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const where = [
    f.q ? sql`(p.title ILIKE ${like} OR p.slug ILIKE ${like})` : sql`TRUE`,
    f.status && (DECK_STATUSES as readonly string[]).includes(f.status) ? sql`p.status = ${f.status}` : sql`p.status <> 'archived'`,
    f.category ? sql`p.category_id = ${f.category}` : sql`TRUE`,
    f.tag ? sql`EXISTS (SELECT 1 FROM presentation_tag_links l JOIN presentation_tags t ON t.id = l.tag_id WHERE l.presentation_id = p.id AND t.slug = ${cleanSlug(f.tag)})` : sql`TRUE`,
  ];
  const res = await db().execute(sql`
    SELECT p.id, p.title, p.slug, p.status, p.mode, p.orientation, p.category_id, p.password_hash IS NOT NULL AS has_password, p.settings, p.published_at, p.author_id, p.created_at, p.updated_at,
      COALESCE(c.name, '') AS category_name,
      COALESCE((SELECT string_agg(t.name, E'\\x1f' ORDER BY t.name) FROM presentation_tag_links l JOIN presentation_tags t ON t.id = l.tag_id WHERE l.presentation_id = p.id), '') AS tag_names,
      (SELECT COUNT(*) FROM presentation_slides s WHERE s.presentation_id = p.id)::int AS slide_count,
      (SELECT COUNT(*) FROM presentation_views v WHERE v.presentation_id = p.id)::int AS views,
      (SELECT COUNT(DISTINCT v.visitor_id) FROM presentation_views v WHERE v.presentation_id = p.id)::int AS uniq,
      (SELECT ROUND(AVG(v.max_slide)::numeric, 1) FROM presentation_views v WHERE v.presentation_id = p.id) AS avg_reach
    FROM presentations p LEFT JOIN presentation_categories c ON c.id = p.category_id
    WHERE ${sql.join(where, sql` AND `)}
    ORDER BY p.updated_at DESC`);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({
    id: Number(r.id),
    title: String(r.title),
    slug: String(r.slug),
    status: cleanStatus(r.status) ?? "draft",
    mode: cleanMode(r.mode),
    orientation: cleanOrientation(r.orientation),
    categoryId: r.category_id === null ? null : Number(r.category_id),
    categoryName: String(r.category_name ?? ""),
    hasPassword: !!r.has_password,
    tags: String(r.tag_names ?? "").split("\x1f").filter(Boolean),
    settings: sanitizeDeckSettings(r.settings),
    publishedAt: r.published_at ? new Date(r.published_at as string) : null,
    authorId: (r.author_id as string | null) ?? null,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
    slides: Number(r.slide_count),
    views: Number(r.views),
    unique: Number(r.uniq),
    avgReach: r.avg_reach === null || r.avg_reach === undefined ? null : Number(r.avg_reach),
  }));
}

/** Active decks that allow search engines and have no password: these go into the sitemap. */
export async function indexableDecks(): Promise<{ slug: string; updatedAt: Date }[]> {
  const rows = await db().select().from(decks).where(eq(decks.status, "active"));
  return rows.map(hydrate).filter((p) => p.settings.indexable && !p.passwordHash).map((p) => ({ slug: p.slug, updatedAt: p.updatedAt }));
}

/* -------------------------------------------------------------------------- */
/* Categories and tags                                                        */
/* -------------------------------------------------------------------------- */

export type Category = { id: number; name: string; slug: string; decks: number };

export async function listCategories(): Promise<Category[]> {
  const res = await db().execute(sql`SELECT c.id, c.name, c.slug, (SELECT COUNT(*) FROM presentations p WHERE p.category_id = c.id)::int AS decks FROM presentation_categories c ORDER BY c.position, c.name`);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({ id: Number(r.id), name: String(r.name), slug: String(r.slug), decks: Number(r.decks) }));
}

export async function createCategory(name: string): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const clean = cleanText(name, 60);
  const slug = cleanSlug(clean);
  if (!clean || !slug) return { ok: false, error: "Give the category a name." };
  const [taken] = await db().select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1);
  if (taken) return { ok: false, error: "A category with this name exists." };
  const [last] = await db().select({ p: categories.position }).from(categories).orderBy(desc(categories.position)).limit(1);
  const [row] = await db().insert(categories).values({ name: clean, slug, position: (last?.p ?? 0) + 1 }).returning({ id: categories.id });
  return { ok: true, id: row.id };
}

export async function renameCategory(id: number, name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const clean = cleanText(name, 60);
  const slug = cleanSlug(clean);
  if (!clean || !slug) return { ok: false, error: "Give the category a name." };
  const [taken] = await db().select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1);
  if (taken && taken.id !== id) return { ok: false, error: "A category with this name exists." };
  await db().update(categories).set({ name: clean, slug }).where(eq(categories.id, id));
  return { ok: true };
}

/** Decks in the category are kept and become uncategorised (ON DELETE SET NULL). */
export async function deleteCategory(id: number): Promise<void> {
  await db().delete(categories).where(eq(categories.id, id));
}

export type Tag = { id: number; name: string; slug: string; decks: number };

export async function listTags(): Promise<Tag[]> {
  const res = await db().execute(sql`SELECT t.id, t.name, t.slug, (SELECT COUNT(*) FROM presentation_tag_links l WHERE l.tag_id = t.id)::int AS decks FROM presentation_tags t ORDER BY t.name`);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({ id: Number(r.id), name: String(r.name), slug: String(r.slug), decks: Number(r.decks) }));
}

export async function tagsOf(deckId: number): Promise<string[]> {
  const res = await db().execute(sql`SELECT t.name FROM presentation_tag_links l JOIN presentation_tags t ON t.id = l.tag_id WHERE l.presentation_id = ${deckId} ORDER BY t.name`);
  return rowsOf<{ name: string }>(res).map((r) => r.name);
}

export function cleanTags(input: unknown): string[] {
  const list = Array.isArray(input) ? input : String(input ?? "").split(",");
  const seen = new Map<string, string>();
  for (const t of list) {
    const name = cleanText(t, 40);
    const slug = cleanSlug(name);
    if (name && slug && !seen.has(slug)) seen.set(slug, name);
  }
  return [...seen.values()].slice(0, 12);
}

/** Replaces the tags of a deck. New tags are created; tags nobody uses any more are removed. */
export async function setTags(deckId: number, names: string[]): Promise<void> {
  const d = db();
  const wanted = cleanTags(names).map((name) => ({ name, slug: cleanSlug(name) }));
  await d.delete(tagLinks).where(eq(tagLinks.presentationId, deckId));
  if (wanted.length) {
    await d.insert(tagsT).values(wanted).onConflictDoNothing();
    const rows = await d.select({ id: tagsT.id }).from(tagsT).where(inArray(tagsT.slug, wanted.map((w) => w.slug)));
    await d.insert(tagLinks).values(rows.map((r) => ({ presentationId: deckId, tagId: r.id })));
  }
  await d.execute(sql`DELETE FROM presentation_tags WHERE id NOT IN (SELECT tag_id FROM presentation_tag_links)`);
}

/* -------------------------------------------------------------------------- */
/* Slides and elements                                                        */
/* -------------------------------------------------------------------------- */

export async function getTree(deckId: number): Promise<DeckSlide[]> {
  const d = db();
  const slideRows = await d.select().from(slidesT).where(eq(slidesT.presentationId, deckId)).orderBy(asc(slidesT.position), asc(slidesT.id));
  if (!slideRows.length) return [];
  const elRows = await d.select().from(elementsT).where(inArray(elementsT.slideId, slideRows.map((s) => s.id))).orderBy(asc(elementsT.position), asc(elementsT.id));
  const bySlide = new Map<number, DeckSlide["elements"]>();
  for (const e of elRows) {
    if (!isElementType(e.type)) continue;
    const list = bySlide.get(e.slideId) ?? [];
    list.push({ id: e.id, type: e.type, settings: elementWithDefaults(e.type, e.settings) });
    bySlide.set(e.slideId, list);
  }
  return slideRows.map((s) => ({ id: s.id, kind: isSlideKind(s.kind) ? s.kind : "blank", settings: slideWithDefaults(s.settings), elements: bySlide.get(s.id) ?? [] }));
}

/** Replaces the whole tree. New rows go in first and the old ones are deleted after, so a failure never loses the deck. */
export async function saveTree(deckId: number, input: SlideInput[]): Promise<DeckSlide[]> {
  const clean = cleanSlideInput(input);
  const d = db();
  const old = (await d.select({ id: slidesT.id }).from(slidesT).where(eq(slidesT.presentationId, deckId))).map((r) => r.id);
  if (clean.length) {
    const inserted = await d
      .insert(slidesT)
      .values(clean.map((s, i) => ({ presentationId: deckId, position: i, kind: s.kind, settings: s.settings })))
      .returning({ id: slidesT.id, position: slidesT.position });
    const idAt = new Map(inserted.map((r) => [r.position, r.id]));
    const rows = clean.flatMap((s, i) => s.elements.map((e, j) => ({ slideId: idAt.get(i) as number, position: j, type: e.type, settings: e.settings })));
    if (rows.length) await d.insert(elementsT).values(rows);
  }
  if (old.length) await d.delete(slidesT).where(inArray(slidesT.id, old)); // elements go with their slide (ON DELETE CASCADE)
  const saved = await getTree(deckId);
  await syncForms(deckId, saved);
  return saved;
}

/** Records which forms the deck embeds, so a form can tell where it is used. */
async function syncForms(deckId: number, slides: DeckSlide[]) {
  const wanted = [...new Set(slides.flatMap((s) => s.elements).filter((e) => e.type === "form").map((e) => Number(e.settings.form_id)).filter((n) => n > 0))];
  const d = db();
  const valid = wanted.length ? (await d.select({ id: schema.bbformsForms.id }).from(schema.bbformsForms).where(inArray(schema.bbformsForms.id, wanted))).map((r) => r.id) : [];
  await d.delete(deckForms).where(eq(deckForms.presentationId, deckId));
  if (valid.length) await d.insert(deckForms).values(valid.map((formId) => ({ presentationId: deckId, formId })));
}

export async function formsUsedBy(deckId: number): Promise<number[]> {
  return (await db().select({ formId: deckForms.formId }).from(deckForms).where(eq(deckForms.presentationId, deckId))).map((r) => r.formId);
}

/** Decks that embed a given form. */
export async function decksUsingForm(formId: number): Promise<{ id: number; title: string; slug: string }[]> {
  const res = await db().execute(sql`SELECT p.id, p.title, p.slug FROM presentation_forms f JOIN presentations p ON p.id = f.presentation_id WHERE f.form_id = ${formId} ORDER BY p.title`);
  return rowsOf<{ id: number; title: string; slug: string }>(res).map((r) => ({ id: Number(r.id), title: String(r.title), slug: String(r.slug) }));
}

/* -------------------------------------------------------------------------- */
/* Decks                                                                      */
/* -------------------------------------------------------------------------- */

async function uniqueSlug(base: string, exceptId = 0): Promise<string> {
  const root = cleanSlug(base).slice(0, 70) || "presentation";
  let slug = root;
  for (let i = 2; i < 200; i++) {
    const [taken] = await db().select({ id: decks.id }).from(decks).where(eq(decks.slug, slug)).limit(1);
    if (!taken || taken.id === exceptId) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

export type CreateOpts = { title: string; slug?: string; template?: string; mode?: string; orientation?: string; categoryId?: number | null };

export async function createDeck(opts: CreateOpts, authorId: string | null): Promise<number> {
  const title = cleanText(opts.title, 255) || "Untitled presentation";
  const slug = await uniqueSlug(opts.slug || title);
  const tpl = DECK_TEMPLATES[opts.template ?? "blank"] ?? DECK_TEMPLATES.blank;
  const categoryId = opts.categoryId ? (await db().select({ id: categories.id }).from(categories).where(eq(categories.id, opts.categoryId)).limit(1))[0]?.id ?? null : null;
  const [row] = await db()
    .insert(decks)
    .values({
      title,
      slug,
      status: "draft",
      mode: opts.mode ? cleanMode(opts.mode) : (tpl.mode ?? "slides"),
      orientation: opts.orientation ? cleanOrientation(opts.orientation) : (tpl.orientation ?? "landscape"),
      categoryId,
      settings: sanitizeDeckSettings(tpl.settings ?? {}),
      authorId,
    })
    .returning({ id: decks.id });
  const slides: SlideInput[] = tpl.slides.map(([kind, edits]) => {
    const s = newSlide(kind);
    for (const [type, over] of Object.entries(edits ?? {})) {
      const el = s.elements.find((e) => e.type === type);
      if (el) el.settings = { ...el.settings, ...over };
    }
    return s;
  });
  await saveTree(row.id, slides);
  return row.id;
}

export type SaveInput = {
  title?: string;
  slug?: string;
  status?: string;
  mode?: string;
  orientation?: string;
  categoryId?: number | null;
  tags?: unknown;
  settings?: unknown;
  slides?: SlideInput[];
  /** A new password, or null to remove it. Leave out to keep the current one. */
  password?: string | null;
  label?: string;
};
export type SaveResult = { ok: true; deck: Deck; slides: DeckSlide[] } | { ok: false; error: string };

/** One call saves everything the builder or the settings screen changed, then keeps a snapshot for undo. */
export async function saveDeck(id: number, input: SaveInput, authorId: string | null): Promise<SaveResult> {
  const before = await getDeck(id);
  if (!before) return { ok: false, error: "Presentation not found." };
  const set: Partial<typeof decks.$inferInsert> = { updatedAt: new Date() };
  if (input.title !== undefined) set.title = cleanText(input.title, 255) || "Untitled presentation";
  if (input.slug !== undefined) {
    const slug = cleanSlug(input.slug);
    if (slug.length < 2) return { ok: false, error: "The address needs at least two letters or numbers." };
    const [taken] = await db().select({ id: decks.id }).from(decks).where(eq(decks.slug, slug)).limit(1);
    if (taken && taken.id !== id) return { ok: false, error: `The address /p/${slug} is already used by another presentation.` };
    set.slug = slug;
  }
  if (input.status !== undefined) {
    const status = cleanStatus(input.status);
    if (!status) return { ok: false, error: "Unknown status." };
    set.status = status;
    if (status === "active" && !before.publishedAt) set.publishedAt = new Date();
  }
  if (input.mode !== undefined) set.mode = cleanMode(input.mode);
  if (input.orientation !== undefined) set.orientation = cleanOrientation(input.orientation);
  if (input.categoryId !== undefined) {
    const cid = Number(input.categoryId);
    set.categoryId = cid > 0 ? ((await db().select({ id: categories.id }).from(categories).where(eq(categories.id, cid)).limit(1))[0]?.id ?? null) : null;
  }
  if (input.settings !== undefined) set.settings = sanitizeDeckSettings(input.settings, before.settings);
  if (input.password === null) set.passwordHash = null;
  else if (typeof input.password === "string" && input.password !== "") {
    if (input.password.length < MIN_DECK_PASSWORD) return { ok: false, error: `The password needs at least ${MIN_DECK_PASSWORD} characters.` };
    set.passwordHash = await hashDeckPassword(input.password);
  }
  await db().update(decks).set(set).where(eq(decks.id, id));
  if (input.tags !== undefined) await setTags(id, cleanTags(input.tags));
  const slides = Array.isArray(input.slides) ? await saveTree(id, input.slides) : await getTree(id);
  const deck = (await getDeck(id)) as Deck;
  await snapshot(deck, slides, authorId, input.label ?? "");
  return { ok: true, deck, slides };
}

const KEEP_REVISIONS = 30;

async function snapshot(deck: Deck, slides: DeckSlide[], authorId: string | null, label: string) {
  const d = db();
  await d.insert(revisions).values({
    presentationId: deck.id,
    authorId,
    label: cleanText(label, 120),
    snapshot: {
      title: deck.title,
      mode: deck.mode,
      orientation: deck.orientation,
      settings: deck.settings,
      slides: slides.map((s) => ({ kind: s.kind, settings: s.settings, elements: s.elements.map((e) => ({ type: e.type, settings: e.settings })) })),
    },
  });
  const old = await d.select({ id: revisions.id }).from(revisions).where(eq(revisions.presentationId, deck.id)).orderBy(desc(revisions.createdAt), desc(revisions.id)).offset(KEEP_REVISIONS);
  if (old.length) await d.delete(revisions).where(inArray(revisions.id, old.map((r) => r.id)));
}

export async function listRevisions(deckId: number) {
  const rows = await db().select({ id: revisions.id, label: revisions.label, createdAt: revisions.createdAt, authorId: revisions.authorId, snapshot: revisions.snapshot }).from(revisions).where(eq(revisions.presentationId, deckId)).orderBy(desc(revisions.createdAt), desc(revisions.id));
  return rows.map((r) => ({ id: r.id, label: r.label, createdAt: r.createdAt, authorId: r.authorId, slides: ((r.snapshot as { slides?: unknown[] })?.slides ?? []).length }));
}

/** Puts a snapshot back as the deck content (title, look and slides; the address, status and password stay). */
export async function restoreRevision(deckId: number, revisionId: number, authorId: string | null): Promise<SaveResult> {
  const [rev] = await db().select().from(revisions).where(eq(revisions.id, revisionId)).limit(1);
  if (!rev || rev.presentationId !== deckId) return { ok: false, error: "Revision not found." };
  const snap = rev.snapshot as { title?: string; mode?: string; orientation?: string; settings?: unknown; slides?: SlideInput[] };
  return saveDeck(deckId, { title: snap.title, mode: snap.mode, orientation: snap.orientation, settings: snap.settings, slides: snap.slides, label: `Restored #${revisionId}` }, authorId);
}

export async function deleteDeck(id: number): Promise<void> {
  // Slides, elements, revisions, views, tag links and form links go with it (ON DELETE CASCADE).
  await db().delete(decks).where(eq(decks.id, id));
  await db().execute(sql`DELETE FROM presentation_tags WHERE id NOT IN (SELECT tag_id FROM presentation_tag_links)`);
}

export async function duplicateDeck(id: number, authorId: string | null): Promise<number> {
  const deck = await getDeck(id);
  if (!deck) return 0;
  const slug = await uniqueSlug(`${deck.slug}-copy`);
  const [row] = await db()
    .insert(decks)
    .values({ title: `${deck.title} (copy)`, slug, status: "draft", mode: deck.mode, orientation: deck.orientation, categoryId: deck.categoryId, passwordHash: deck.passwordHash, settings: deck.settings, authorId })
    .returning({ id: decks.id });
  await saveTree(row.id, await getTree(id));
  await setTags(row.id, await tagsOf(id));
  return row.id;
}

export function treeToInput(slides: DeckSlide[]): SlideInput[] {
  return slides.map((s) => ({ id: s.id, kind: s.kind, settings: s.settings, elements: s.elements.map((e): ElementInput => ({ id: e.id, type: e.type, settings: e.settings })) }));
}
