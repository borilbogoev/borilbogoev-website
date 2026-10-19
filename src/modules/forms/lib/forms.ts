// Forms and blocks: storage and rules. Ported from class-bbf-forms.php.
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { schema } from "@/db";
import { db, rowsOf } from "@/db/use";
import { blockDefaults, isBlockType, isInput, sanitizeBlockSettings, withDefaults, type Block, type BlockType, type Settings } from "./blocks";
import { cleanKey, cleanSlug, cleanText } from "./sanitize";
import { formSettingsDefaults, sanitizeFormSettings, FORM_STATUSES, type FormSettings, type FormStatus } from "./settings";
import { getGlobalSettings } from "./settings-store";

const { bbformsForms: forms, bbformsBlocks: blocksTable } = schema;

export type Form = {
  id: number;
  title: string;
  status: FormStatus;
  slug: string | null;
  settings: FormSettings;
  lastSeq: number;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function hydrate(row: typeof forms.$inferSelect): Form {
  return {
    id: row.id,
    title: row.title,
    status: (FORM_STATUSES as readonly string[]).includes(row.status) ? (row.status as FormStatus) : "draft",
    slug: row.slug,
    settings: sanitizeFormSettings(row.settings),
    lastSeq: row.lastSeq,
    authorId: row.authorId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getForm(id: number): Promise<Form | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const [row] = await db().select().from(forms).where(eq(forms.id, id)).limit(1);
  return row ? hydrate(row) : null;
}

export async function getFormBySlug(slug: string): Promise<Form | null> {
  const clean = cleanSlug(slug);
  if (!clean) return null;
  const [row] = await db().select().from(forms).where(eq(forms.slug, clean)).limit(1);
  return row ? hydrate(row) : null;
}

export type FormListItem = {
  id: number;
  title: string;
  status: FormStatus;
  slug: string | null;
  createdAt: Date;
  updatedAt: Date;
  responses: number;
  unread: number;
  lastResponse: Date | null;
  views: number;
};

export async function listForms(search = ""): Promise<FormListItem[]> {
  const like = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const res = await db().execute(sql`
    SELECT f.id, f.title, f.status, f.slug, f.created_at, f.updated_at,
      (SELECT COUNT(*) FROM bbforms_responses r WHERE r.form_id = f.id)::int AS responses,
      (SELECT COUNT(*) FROM bbforms_responses r WHERE r.form_id = f.id AND NOT r.is_read)::int AS unread,
      (SELECT MAX(created_at) FROM bbforms_responses r WHERE r.form_id = f.id) AS last_response,
      (SELECT COALESCE(SUM(views), 0) FROM bbforms_stats s WHERE s.form_id = f.id)::int AS views
    FROM bbforms_forms f
    ${search ? sql`WHERE f.title ILIKE ${like}` : sql``}
    ORDER BY f.updated_at DESC`);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({
    id: Number(r.id),
    title: String(r.title),
    status: r.status as FormStatus,
    slug: (r.slug as string | null) ?? null,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
    responses: Number(r.responses),
    unread: Number(r.unread),
    lastResponse: r.last_response ? new Date(r.last_response as string) : null,
    views: Number(r.views),
  }));
}

export async function createForm(title: string, template: string, authorId: string | null): Promise<number> {
  const [row] = await db()
    .insert(forms)
    .values({ title: cleanText(title, 255) || "Untitled form", status: "active", settings: formSettingsDefaults(), authorId })
    .returning({ id: forms.id });
  const tpl = TEMPLATES[template];
  if (tpl) {
    await saveBlocks(
      row.id,
      tpl.blocks.map(([type, key, extra]) => ({ type, fieldKey: key, settings: { ...blockDefaults(type), ...(extra ?? {}) } })),
    );
    if (tpl.mode) await updateForm(row.id, { settings: { ...formSettingsDefaults(), mode: tpl.mode } });
  }
  return row.id;
}

export type FormPatch = { title?: string; status?: string; slug?: string | null; settings?: unknown };

export type UpdateResult = { ok: true } | { ok: false; error: string };

export async function updateForm(id: number, patch: FormPatch): Promise<UpdateResult> {
  const set: Partial<typeof forms.$inferInsert> = { updatedAt: new Date() };
  if (patch.title !== undefined) set.title = cleanText(patch.title, 255) || "Untitled form";
  if (patch.status !== undefined && (FORM_STATUSES as readonly string[]).includes(patch.status)) set.status = patch.status;
  if (patch.settings !== undefined) set.settings = sanitizeFormSettings(patch.settings);
  if (patch.slug !== undefined) {
    const slug = patch.slug ? cleanSlug(patch.slug) : "";
    if (slug) {
      const [taken] = await db().select({ id: forms.id }).from(forms).where(eq(forms.slug, slug)).limit(1);
      if (taken && taken.id !== id) return { ok: false, error: `The page address /s/${slug} is already used by another form.` };
      if (RESERVED_SLUGS.has(slug)) return { ok: false, error: "This page address is reserved." };
    }
    set.slug = slug || null;
  }
  await db().update(forms).set(set).where(eq(forms.id, id));
  return { ok: true };
}

const RESERVED_SLUGS = new Set(["admin", "api"]);

export async function deleteForm(id: number): Promise<void> {
  // Blocks, responses, answers and stats go with it (ON DELETE CASCADE).
  await db().delete(forms).where(eq(forms.id, id));
}

export async function duplicateForm(id: number, authorId: string | null): Promise<number> {
  const form = await getForm(id);
  if (!form) return 0;
  const newId = await createForm(`${form.title} (copy)`, "none", authorId);
  await updateForm(newId, { settings: form.settings, status: "draft" });
  const blocks = await getBlocks(id);
  await saveBlocks(newId, blocks.map((b) => ({ type: b.type, fieldKey: b.fieldKey, settings: b.settings })));
  return newId;
}

export async function getBlocks(formId: number): Promise<Block[]> {
  const rows = await db().select().from(blocksTable).where(eq(blocksTable.formId, formId)).orderBy(asc(blocksTable.position), asc(blocksTable.id));
  const out: Block[] = [];
  for (const r of rows) {
    if (!isBlockType(r.type)) continue;
    out.push({ id: r.id, type: r.type, fieldKey: r.fieldKey, settings: withDefaults(r.type, r.settings) });
  }
  return out;
}

export type BlockInput = { id?: number; type: string; fieldKey?: string; settings?: unknown };

/** Persists the full ordered list of blocks: inserts, updates and deletes. Returns the saved blocks. */
export async function saveBlocks(formId: number, input: BlockInput[]): Promise<Block[]> {
  const d = db();
  const existing = new Set((await d.select({ id: blocksTable.id }).from(blocksTable).where(eq(blocksTable.formId, formId))).map((r) => r.id));
  const keep: number[] = [];
  const used = new Set<string>();
  let hasContact = false;
  let pos = 0;

  for (const b of input) {
    const type = String(b.type ?? "");
    if (!isBlockType(type)) continue;
    if (type === "contact") {
      if (hasContact) continue; // only one contact block per form
      hasContact = true;
    }
    const settings = sanitizeBlockSettings(type, b.settings);
    let key = "";
    if (isInput(type) && type !== "contact") {
      key = cleanKey(b.fieldKey) || type;
      const base = key;
      let i = 2;
      while (used.has(key)) key = `${base}_${i++}`;
      used.add(key);
    }
    const row = { formId, position: pos++, type, fieldKey: key, settings };
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
  await d.update(forms).set({ updatedAt: new Date() }).where(eq(forms.id, formId));
  return getBlocks(formId);
}

/** "YYYY-MM-DD HH:mm" in a time zone. */
export function nowIn(timeZone: string, at = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(at)
    .reduce<Record<string, string>>((acc, x) => ({ ...acc, [x.type]: x.value }), {});
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

export type ClosedReason = "" | "status" | "not_open" | "closed" | "limit";

/** Whether a form currently accepts responses. Returns "" when open, or the reason. */
export async function closedReason(form: Form): Promise<ClosedReason> {
  const s = form.settings;
  if (form.status !== "active") return "status";
  const tz = (await getGlobalSettings()).timezone;
  const now = nowIn(tz);
  if (s.open_at && now < s.open_at) return "not_open";
  if (s.close_at && now >= s.close_at) return "closed";
  if (s.max_responses > 0) {
    const [r] = rowsOf<{ n: number }>(await db().execute(sql`SELECT COUNT(*)::int AS n FROM bbforms_responses WHERE form_id = ${form.id}`));
    if ((r?.n ?? 0) >= s.max_responses) return "limit";
  }
  return "";
}

export async function latestForms(limit = 200): Promise<{ id: number; title: string }[]> {
  return db().select({ id: forms.id, title: forms.title }).from(forms).orderBy(desc(forms.updatedAt)).limit(limit);
}

/* -------------------------------------------------------------------------- */
/* Templates for "New form"                                                   */
/* -------------------------------------------------------------------------- */

type TemplateBlock = [BlockType, string, Settings?];
export type FormTemplate = { label: string; desc: string; mode?: "conversational"; blocks: TemplateBlock[] };

export const TEMPLATES: Record<string, FormTemplate> = {
  blank: { label: "Blank form", desc: "Start from scratch.", blocks: [] },
  contact: {
    label: "Contact form",
    desc: "Contact details, topic and message.",
    blocks: [
      ["heading", "", { eyebrow: "Get in touch", text: "Let's work together", level: "h2", accent_dot: 1 }],
      ["text", "", { content: "Tell us a bit about you and we will get back within one business day." }],
      ["contact", ""],
      ["choice", "topic", { question: "What can we help with?", options: ["AI adoption program", "Workflow automation", "Training & workshops", "Something else"], required: 1 }],
      ["long_text", "message", { question: "Your message", required: 1 }],
      ["consent", "consent", { text: "I agree to be contacted about my request." }],
    ],
  },
  feedback: {
    label: "Customer feedback / NPS",
    desc: "NPS, rating and open feedback over two pages.",
    blocks: [
      ["heading", "", { eyebrow: "Feedback", text: "How did we do?", accent_dot: 1 }],
      ["scale", "nps", { required: 1 }],
      ["rating", "satisfaction", { question: "Overall satisfaction", required: 1 }],
      ["page_break", ""],
      ["choice", "liked_most", { question: "What did you like most?", multiple: 1, max_select: 2, options: ["Quality", "Speed", "Support", "Price"] }],
      ["long_text", "improve", { question: "What could we improve?", logic: { enabled: 1, field: "nps", op: "lt", value: "9" } }],
      ["email", "email", { question: "Email (optional, if you would like a reply)" }],
    ],
  },
  event: {
    label: "Event registration",
    desc: "Attendee details, session choice and preferences.",
    blocks: [
      ["heading", "", { eyebrow: "Registration", text: "Reserve your seat", accent_dot: 1 }],
      ["contact", ""],
      ["page_break", ""],
      ["dropdown", "session", { question: "Which session will you attend?", options: ["Morning (10:00)", "Afternoon (15:00)", "Online"], required: 1 }],
      ["number", "guests", { question: "Number of guests", min: "0", max: "5", placeholder: "0" }],
      ["yes_no", "dietary", { question: "Any dietary requirements?" }],
      ["short_text", "dietary_details", { question: "Please specify", logic: { enabled: 1, field: "dietary", op: "equals", value: "Yes" } }],
      ["hidden", "utm_source", { question: "UTM source", param: "utm_source" }],
    ],
  },
  lead: {
    label: "Lead qualification",
    desc: "Conversational B2B lead qualifier.",
    mode: "conversational",
    blocks: [
      ["short_text", "first_name", { question: "Hi! What's your first name?", required: 1 }],
      ["dropdown", "company_size", { question: "How big is your team?", options: ["1-10", "11-50", "51-200", "201-1000", "1000+"], required: 1 }],
      ["choice", "challenge", { question: "What is your biggest operational challenge?", options: ["Manual repetitive work", "Disconnected tools", "Reporting & visibility", "Team AI adoption"], required: 1 }],
      ["number", "budget", { question: "Approximate monthly budget", unit: "USD", min: "0" }],
      ["email", "email", { question: "Where should we send your proposal?", required: 1 }],
    ],
  },
};
