// Import of the BB Forms WP plugin data (the six `{prefix}bbforms-*` tables) into the Forms module.
// Input: the phpMyAdmin SQL exports of those tables. Output: one atomic transaction and a verification report.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isBlockType } from "../lib/blocks";
import { cleanSlug } from "../lib/sanitize";
import { sanitizeFormSettings } from "../lib/settings";
import { parseInserts, type DumpRow } from "./mysql-dump";

export type WpData = {
  forms: DumpRow[];
  blocks: DumpRow[];
  responses: DumpRow[];
  answers: DumpRow[];
  stats: DumpRow[];
  settings: DumpRow[];
};

const TABLES = ["forms", "blocks", "responses", "answers", "stats", "settings"] as const;

/** Reads every `*bbforms-<table>*.sql` export in a folder. */
export function readWpExports(dir: string): WpData {
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));
  const data = { forms: [], blocks: [], responses: [], answers: [], stats: [], settings: [] } as WpData;
  for (const t of TABLES) {
    const matches = files.filter((f) => new RegExp(`bbforms-${t}\\b`).test(f));
    if (matches.length !== 1) throw new Error(`Expected exactly one export for bbforms-${t} in ${dir}, found ${matches.length}.`);
    const parsed = parseInserts(readFileSync(join(dir, matches[0]), "utf8"));
    data[t] = [...parsed.entries()].filter(([name]) => name.endsWith(`bbforms-${t}`)).flatMap(([, rows]) => rows);
  }
  return data;
}

export type Stmt = { text: string; params: unknown[] };

export type ImportOptions = {
  /** Time zone WordPress used for its DATETIME columns (Settings > General > Timezone). */
  wpTimeZone: string;
  /** Email of an existing Forms user to record as the form author. */
  ownerEmail?: string;
  /** Replace forms that already exist with the same id. */
  force?: boolean;
  /** Old image URL -> new URL. Images in blocks pointed at the WordPress media library. */
  assetMap?: Record<string, string>;
  /** Public page address for each form id, when it cannot be read from the responses. */
  slugs?: Record<number, string>;
};

export type Plan = {
  statements: Stmt[];
  expected: { forms: number; blocks: number; responses: number; answers: number; stats: number };
  notes: string[];
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const num = (v: unknown) => Number(v ?? 0);

function parseJson(v: unknown): unknown {
  try {
    return JSON.parse(str(v));
  } catch {
    return null;
  }
}

function replaceUrls(value: unknown, map: Record<string, string>): unknown {
  if (typeof value === "string") return map[value] ?? value;
  if (Array.isArray(value)) return value.map((v) => replaceUrls(v, map));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceUrls(v, map)]));
  return value;
}

/** Slug and page title of the WordPress page that embedded each form, read from where the responses came from. */
export function pageInfo(data: WpData): Map<number, { slug: string; title: string }> {
  const latest = new Map<number, { at: string; slug: string; title: string }>();
  for (const r of data.responses) {
    const meta = parseJson(r.meta) as { page_url?: string; page_title?: string } | null;
    const m = /^https?:\/\/[^/]+\/s\/([^/?#]+)/.exec(meta?.page_url ?? str(r.page_url));
    if (!m) continue;
    const formId = num(r.form_id);
    const at = str(r.created_at);
    const title = str(meta?.page_title).replace(/\s*\|\s*Boril Bogoev, Ph\.D\.\s*$/, "").trim();
    const cur = latest.get(formId);
    if (!cur || at >= cur.at) latest.set(formId, { at, slug: cleanSlug(decodeURIComponent(m[1])), title });
  }
  return new Map([...latest].map(([id, v]) => [id, { slug: v.slug, title: v.title }]));
}

const TZ_OK = /^[A-Za-z0-9_+\-/]+$/;

/** Builds the SQL for the whole import. Nothing is executed here. */
export function planImport(data: WpData, opts: ImportOptions): Plan {
  if (!TZ_OK.test(opts.wpTimeZone)) throw new Error("Invalid time zone.");
  const tz = `'${opts.wpTimeZone}'`;
  const at = (n: number) => `($${n}::timestamp AT TIME ZONE ${tz})`;
  const notes: string[] = [];
  const statements: Stmt[] = [];
  const pages = pageInfo(data);
  const formIds = data.forms.map((f) => num(f.id));

  if (opts.force && formIds.length) statements.push({ text: "DELETE FROM bbforms_forms WHERE id = ANY($1::int[])", params: [formIds] });

  const chunk = <T>(rows: T[], size: number) => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));

  // Forms.
  for (const f of data.forms) {
    const id = num(f.id);
    const raw = (parseJson(f.settings) ?? {}) as Record<string, unknown>;
    if (num(raw.thankyou_page) > 0) notes.push(`Form ${id} redirected to WordPress page ${raw.thankyou_page}; set the redirect again in the form settings.`);
    const page = pages.get(id);
    const slug = opts.slugs?.[id] ?? page?.slug ?? null;
    if (!slug) notes.push(`Form ${id} has no public page address (/s/<slug>); it can only be embedded.`);
    const settings = sanitizeFormSettings({ ...raw, thankyou_page: "", page_title: page?.title ?? "" });
    statements.push({
      text: `INSERT INTO bbforms_forms (id, title, status, slug, settings, last_seq, author_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, (SELECT id FROM users WHERE email = $7), ${at(8)}, ${at(9)})`,
      params: [id, str(f.title), str(f.status), slug, JSON.stringify(settings), num(f.last_seq), (opts.ownerEmail ?? "").toLowerCase() || null, str(f.created_at), str(f.updated_at)],
    });
  }

  // Blocks.
  const blocks = data.blocks.filter((b) => {
    const ok = isBlockType(b.type);
    if (!ok) notes.push(`Block ${b.id} has the unknown type "${b.type}" and was skipped.`);
    return ok;
  });
  for (const part of chunk(blocks, 100)) {
    const params: unknown[] = [];
    const rows = part.map((b) => {
      const settings = replaceUrls(parseJson(b.settings) ?? {}, opts.assetMap ?? {});
      params.push(num(b.id), num(b.form_id), num(b.position), str(b.type), str(b.field_key), JSON.stringify(settings));
      const n = params.length;
      return `($${n - 5}, $${n - 4}, $${n - 3}, $${n - 2}, $${n - 1}, $${n}::jsonb)`;
    });
    statements.push({ text: `INSERT INTO bbforms_blocks (id, form_id, position, type, field_key, settings) VALUES ${rows.join(", ")}`, params });
  }

  // Responses.
  for (const part of chunk(data.responses, 50)) {
    const params: unknown[] = [];
    const rows = part.map((r) => {
      const meta = parseJson(r.meta);
      params.push(
        num(r.id), num(r.form_id), num(r.seq), str(r.status), num(r.is_read) === 1, str(r.origin), str(r.channel), str(r.device), str(r.ip), str(r.ip_hash), str(r.user_agent),
        r.referrer === null ? null : str(r.referrer) || null, r.page_url === null ? null : str(r.page_url) || null, num(r.duration), meta ? JSON.stringify(meta) : null, str(r.created_at), str(r.updated_at),
      );
      const n = params.length;
      return `($${n - 16}, $${n - 15}, $${n - 14}, $${n - 13}, $${n - 12}, $${n - 11}, $${n - 10}, $${n - 9}, $${n - 8}, $${n - 7}, $${n - 6}, $${n - 5}, $${n - 4}, $${n - 3}, $${n - 2}::jsonb, ${at(n - 1)}, ${at(n)})`;
    });
    statements.push({
      text: `INSERT INTO bbforms_responses (id, form_id, seq, status, is_read, origin, channel, device, ip, ip_hash, user_agent, referrer, page_url, duration, meta, created_at, updated_at) VALUES ${rows.join(", ")}`,
      params,
    });
  }
  if (data.responses.some((r) => num(r.user_id) > 0)) notes.push("Some responses were added by WordPress users; the user link is not carried over.");

  // Answers: values are copied as they are (multi-value answers stay JSON array strings).
  for (const part of chunk(data.answers, 200)) {
    const params: unknown[] = [];
    const rows = part.map((a) => {
      params.push(num(a.id), num(a.response_id), num(a.form_id), str(a.field_key), a.value === null ? null : str(a.value));
      const n = params.length;
      return `($${n - 4}, $${n - 3}, $${n - 2}, $${n - 1}, $${n})`;
    });
    statements.push({ text: `INSERT INTO bbforms_answers (id, response_id, form_id, field_key, value) VALUES ${rows.join(", ")}`, params });
  }

  // Daily views and starts.
  for (const part of chunk(data.stats, 200)) {
    const params: unknown[] = [];
    const rows = part.map((s) => {
      params.push(num(s.form_id), str(s.day), num(s.views), num(s.starts));
      const n = params.length;
      return `($${n - 3}, $${n - 2}::date, $${n - 1}, $${n})`;
    });
    statements.push({ text: `INSERT INTO bbforms_stats (form_id, day, views, starts) VALUES ${rows.join(", ")}`, params });
  }

  // Global settings: the plugin only stored its database version, which means "all defaults".
  const custom = data.settings.filter((s) => str(s.name) !== "db_version");
  if (custom.length) notes.push(`Global settings (${custom.map((s) => s.name).join(", ")}) are not imported; set them in Forms > Settings.`);

  // Keep the id sequences ahead of the imported ids.
  for (const t of ["bbforms_forms", "bbforms_blocks", "bbforms_responses", "bbforms_answers"]) {
    statements.push({ text: `SELECT setval(pg_get_serial_sequence('${t}', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM ${t}), 1))`, params: [] });
  }

  return {
    statements,
    expected: { forms: data.forms.length, blocks: blocks.length, responses: data.responses.length, answers: data.answers.length, stats: data.stats.length },
    notes,
  };
}

/* -------------------------------------------------------------------------- */
/* Verification                                                               */
/* -------------------------------------------------------------------------- */

export type Query = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
export type Check = { name: string; expected: unknown; actual: unknown; ok: boolean };

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

/** Compares the database with the export: row counts, per-form counts, and a checksum of every answer. */
export async function verifyImport(query: Query, data: WpData, plan: Plan, wpTimeZone: string): Promise<Check[]> {
  if (!TZ_OK.test(wpTimeZone)) throw new Error("Invalid time zone.");
  const checks: Check[] = [];
  const add = (name: string, expected: unknown, actual: unknown) => checks.push({ name, expected, actual, ok: String(expected) === String(actual) });
  const count = async (t: string, where = "TRUE", params: unknown[] = []) => Number((await query(`SELECT COUNT(*)::int AS n FROM ${t} WHERE ${where}`, params))[0].n);

  const formIds = data.forms.map((f) => num(f.id));
  for (const t of ["forms", "blocks", "responses", "answers", "stats"] as const) {
    const where = t === "forms" ? "id = ANY($1::int[])" : "form_id = ANY($1::int[])";
    add(`rows in bbforms_${t}`, plan.expected[t], await count(`bbforms_${t}`, where, [formIds]));
  }
  for (const id of formIds) {
    add(`responses of form ${id}`, data.responses.filter((r) => num(r.form_id) === id).length, await count("bbforms_responses", "form_id = $1", [id]));
    const form = data.forms.find((f) => num(f.id) === id)!;
    const [row] = await query("SELECT last_seq, title, status FROM bbforms_forms WHERE id = $1", [id]);
    add(`form ${id} last_seq`, num(form.last_seq), row?.last_seq);
    add(`form ${id} title`, str(form.title), row?.title);
    add(`form ${id} status`, str(form.status), row?.status);
    const maxSeq = Math.max(0, ...data.responses.filter((r) => num(r.form_id) === id).map((r) => num(r.seq)));
    add(`form ${id} highest response number`, maxSeq, (await query("SELECT COALESCE(MAX(seq), 0)::int AS m FROM bbforms_responses WHERE form_id = $1", [id]))[0].m);
  }

  // One checksum over every answer of every response, in id order.
  const source = md5(
    [...data.answers]
      .sort((a, b) => num(a.id) - num(b.id))
      .map((a) => `${num(a.response_id)}|${str(a.field_key)}|${a.value === null ? "" : str(a.value)}`)
      .join("\n"),
  );
  const dbRows = await query("SELECT response_id, field_key, COALESCE(value, '') AS value FROM bbforms_answers WHERE form_id = ANY($1::int[]) ORDER BY id", [formIds]);
  add("checksum of all answers", source, md5(dbRows.map((r) => `${r.response_id}|${r.field_key}|${r.value}`).join("\n")));

  // Every response keeps its own timestamp, source and device.
  const rs = await query(
    `SELECT id, seq, is_read, channel, device, duration, ip_hash, to_char(created_at AT TIME ZONE '${wpTimeZone}', 'YYYY-MM-DD HH24:MI:SS') AS created
     FROM bbforms_responses WHERE form_id = ANY($1::int[]) ORDER BY id`,
    [formIds],
  );
  const dbMeta = md5(rs.map((r) => `${r.id}|${r.seq}|${r.is_read ? 1 : 0}|${r.channel}|${r.device}|${r.duration}|${r.ip_hash}|${r.created}`).join("\n"));
  const srcMeta = md5(
    [...data.responses]
      .sort((a, b) => num(a.id) - num(b.id))
      .map((r) => `${num(r.id)}|${num(r.seq)}|${num(r.is_read)}|${str(r.channel)}|${str(r.device)}|${num(r.duration)}|${str(r.ip_hash)}|${str(r.created_at)}`)
      .join("\n"),
  );
  add("checksum of response details", srcMeta, dbMeta);
  return checks;
}
