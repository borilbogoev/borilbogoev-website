// Responses: storage, querying and editing. Ported from class-bbf-responses.php.
import { eq, inArray, sql, type SQL } from "drizzle-orm";
import { schema } from "@/db";
import { db, rowsOf } from "@/db/use";
import { cleanKey } from "./sanitize";

const { bbformsResponses: responses, bbformsAnswers: answers, bbformsForms: forms } = schema;

export type AnswerValue = string | string[];
export type Values = Record<string, AnswerValue>;

export type ResponseRecord = {
  id: number;
  form_id: number;
  seq: number;
  created_at: string; // ISO, UTC
  updated_at: string;
  duration: number;
  device: string;
  channel: string;
  origin: string;
  is_read: boolean;
  values: Values;
  // Only on single-record reads and exports:
  ip?: string;
  user_agent?: string;
  referrer?: string | null;
  page_url?: string | null;
  user_id?: string | null;
  user_label?: string;
  meta?: Record<string, unknown> | null;
};

/** Multi-value answers are stored as a JSON array string, as in the plugin. */
export function encodeValue(v: AnswerValue): string {
  return Array.isArray(v) ? JSON.stringify(v) : String(v);
}

export function decodeValue(v: string | null): AnswerValue {
  if (typeof v === "string" && v.startsWith("[")) {
    try {
      const d: unknown = JSON.parse(v);
      if (Array.isArray(d)) return d.map(String);
    } catch {
      // not JSON: a plain answer that happens to start with "["
    }
  }
  return v ?? "";
}

const ISO = (col: string) => sql.raw(`to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`);

export async function countResponses(formId: number): Promise<number> {
  const [r] = rowsOf<{ n: number }>(await db().execute(sql`SELECT COUNT(*)::int AS n FROM bbforms_responses WHERE form_id = ${formId}`));
  return r?.n ?? 0;
}

export async function unreadTotal(): Promise<number> {
  const [r] = rowsOf<{ n: number }>(await db().execute(sql`SELECT COUNT(*)::int AS n FROM bbforms_responses WHERE NOT is_read`));
  return r?.n ?? 0;
}

export type NewResponseMeta = {
  origin?: string;
  channel?: string;
  device?: string;
  ip?: string;
  ipHash?: string;
  userAgent?: string;
  referrer?: string;
  pageUrl?: string;
  userId?: string | null;
  duration?: number;
  meta?: Record<string, unknown> | null;
  createdAt?: Date;
};

async function writeValues(responseId: number, formId: number, values: Values) {
  const rows = Object.entries(values).map(([fieldKey, v]) => ({ responseId, formId, fieldKey, value: encodeValue(v) }));
  if (rows.length) await db().insert(answers).values(rows);
}

/** Inserts a response with its answers. The per-form sequence number is allocated atomically. */
export async function insertResponse(formId: number, values: Values, m: NewResponseMeta = {}): Promise<{ id: number; seq: number }> {
  const [bump] = await db()
    .update(forms)
    .set({ lastSeq: sql`${forms.lastSeq} + 1` })
    .where(eq(forms.id, formId))
    .returning({ seq: forms.lastSeq });
  if (!bump) throw new Error("Form not found.");
  const created = m.createdAt ?? new Date();
  const origin = m.origin ?? "form";
  const [row] = await db()
    .insert(responses)
    .values({
      formId,
      seq: bump.seq,
      status: "complete",
      isRead: origin === "admin",
      origin,
      channel: m.channel ?? "direct",
      device: m.device ?? "",
      ip: m.ip ?? "",
      ipHash: m.ipHash ?? "",
      userAgent: m.userAgent ?? "",
      referrer: m.referrer || null,
      pageUrl: m.pageUrl || null,
      userId: m.userId ?? null,
      duration: m.duration ?? 0,
      meta: m.meta ?? null,
      createdAt: created,
      updatedAt: created,
    })
    .returning({ id: responses.id });
  try {
    await writeValues(row.id, formId, values);
  } catch (error) {
    await db().delete(responses).where(eq(responses.id, row.id)); // never leave a response without its answers
    throw error;
  }
  return { id: row.id, seq: bump.seq };
}

export async function updateValues(id: number, formId: number, values: Values, createdAt?: Date | null): Promise<void> {
  await db().delete(answers).where(eq(answers.responseId, id));
  await writeValues(id, formId, values);
  await db()
    .update(responses)
    .set({ updatedAt: new Date(), ...(createdAt ? { createdAt } : {}) })
    .where(eq(responses.id, id));
}

export async function deleteResponses(ids: number[]): Promise<number> {
  const clean = ids.filter((i) => Number.isInteger(i) && i > 0);
  if (!clean.length) return 0;
  const gone = await db().delete(responses).where(inArray(responses.id, clean)).returning({ id: responses.id }); // answers cascade
  return gone.length;
}

export async function markRead(id: number, read: boolean): Promise<void> {
  await db().update(responses).set({ isRead: read }).where(eq(responses.id, id));
}

async function attachValues<T extends { id: number }>(rows: T[]): Promise<(T & { values: Values })[]> {
  if (!rows.length) return [];
  const found = await db()
    .select({ responseId: answers.responseId, fieldKey: answers.fieldKey, value: answers.value })
    .from(answers)
    .where(
      inArray(
        answers.responseId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(answers.id);
  const map = new Map<number, Values>();
  for (const a of found) {
    const v = map.get(a.responseId) ?? {};
    v[a.fieldKey] = decodeValue(a.value);
    map.set(a.responseId, v);
  }
  return rows.map((r) => ({ ...r, values: map.get(r.id) ?? {} }));
}

const COLUMNS = sql`r.id, r.form_id, r.seq, r.duration, r.device, r.channel, r.origin, r.is_read,
  ${ISO("r.created_at")} AS created_at, ${ISO("r.updated_at")} AS updated_at`;
const FULL_COLUMNS = sql`${COLUMNS}, r.ip, r.user_agent, r.referrer, r.page_url, r.user_id, r.meta, COALESCE(NULLIF(u.name, ''), u.email) AS user_label`;

function format(r: Record<string, unknown>, full: boolean): Omit<ResponseRecord, "values"> {
  const out: Omit<ResponseRecord, "values"> = {
    id: Number(r.id),
    form_id: Number(r.form_id),
    seq: Number(r.seq),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    duration: Number(r.duration),
    device: String(r.device ?? ""),
    channel: String(r.channel ?? ""),
    origin: String(r.origin ?? ""),
    is_read: r.is_read === true || r.is_read === "t" || r.is_read === 1,
  };
  if (full) {
    out.ip = String(r.ip ?? "");
    out.user_agent = String(r.user_agent ?? "");
    out.referrer = (r.referrer as string | null) ?? null;
    out.page_url = (r.page_url as string | null) ?? null;
    out.user_id = (r.user_id as string | null) ?? null;
    if (r.user_label) out.user_label = String(r.user_label);
    out.meta = (typeof r.meta === "string" ? safeJson(r.meta) : (r.meta as Record<string, unknown> | null)) ?? null;
  }
  return out;
}

function safeJson(s: string) {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function getResponse(id: number): Promise<ResponseRecord | null> {
  const res = await db().execute(sql`SELECT ${FULL_COLUMNS} FROM bbforms_responses r LEFT JOIN users u ON u.id = r.user_id WHERE r.id = ${id}`);
  const [row] = rowsOf<Record<string, unknown>>(res);
  if (!row) return null;
  const [withValues] = await attachValues([format(row, true) as ResponseRecord]);
  return withValues;
}

export type ResponseQuery = {
  from?: string; // YYYY-MM-DD in the forms timezone
  to?: string;
  search?: string;
  filters?: Record<string, string>;
  orderby?: string;
  order?: string;
  page?: number;
  perPage?: number;
  all?: boolean;
  numericKeys?: string[];
  timeZone?: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const likeOf = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** WHERE clause (alias `r`) shared by the list, the CSV export and the dashboard. */
export function responsesWhere(formId: number, a: Pick<ResponseQuery, "from" | "to" | "search" | "filters" | "timeZone">): SQL {
  const tz = a.timeZone ?? "UTC";
  const parts: SQL[] = [sql`r.form_id = ${formId}`];
  if (a.from && DAY.test(a.from)) parts.push(sql`r.created_at >= (${a.from}::timestamp AT TIME ZONE ${tz})`);
  if (a.to && DAY.test(a.to)) parts.push(sql`r.created_at < ((${a.to}::date + 1)::timestamp AT TIME ZONE ${tz})`);
  const q = (a.search ?? "").trim();
  if (q) {
    let any = sql`EXISTS (SELECT 1 FROM bbforms_answers s WHERE s.response_id = r.id AND s.value ILIKE ${likeOf(q)})`;
    const m = /^#?(\d+)$/.exec(q);
    if (m) any = sql`${any} OR r.id = ${Number(m[1])} OR r.seq = ${Number(m[1])}`;
    parts.push(sql`(${any})`);
  }
  for (const [key, raw] of Object.entries(a.filters ?? {})) {
    const val = String(raw ?? "").trim();
    if (!val) continue;
    if (key === "device" || key === "channel" || key === "origin") {
      parts.push(sql`r.${sql.raw(key)} ILIKE ${likeOf(val)}`);
    } else if (key === "is_read") {
      parts.push(val === "unread" ? sql`NOT r.is_read` : sql`r.is_read`);
    } else {
      parts.push(sql`EXISTS (SELECT 1 FROM bbforms_answers f WHERE f.response_id = r.id AND f.field_key = ${cleanKey(key)} AND f.value ILIKE ${likeOf(val)})`);
    }
  }
  return sql.join(parts, sql` AND `);
}

const SORTABLE = new Set(["id", "seq", "created_at", "duration", "device", "channel", "origin", "is_read"]);

export async function queryResponses(formId: number, a: ResponseQuery): Promise<{ items: ResponseRecord[]; total: number }> {
  const where = responsesWhere(formId, a);
  const dir = String(a.order).toLowerCase() === "asc" ? sql`ASC` : sql`DESC`;
  const ob = a.orderby ?? "id";
  let orderBy: SQL;
  if (SORTABLE.has(ob)) {
    orderBy = sql`r.${sql.raw(ob)} ${dir}`;
  } else {
    const key = cleanKey(ob.replace(/^f:/, ""));
    const sub = sql`(SELECT o.value FROM bbforms_answers o WHERE o.response_id = r.id AND o.field_key = ${key} LIMIT 1)`;
    orderBy = a.numericKeys?.includes(key) ? sql`CASE WHEN ${sub} ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${sub})::numeric END ${dir} NULLS LAST` : sql`${sub} ${dir}`;
  }

  const [{ n }] = rowsOf<{ n: number }>(await db().execute(sql`SELECT COUNT(*)::int AS n FROM bbforms_responses r WHERE ${where}`));
  let limit = sql``;
  if (!a.all) {
    const per = Math.max(1, Math.min(500, a.perPage ?? 25));
    const page = Math.max(1, a.page ?? 1);
    limit = sql`LIMIT ${per} OFFSET ${(page - 1) * per}`;
  }
  const res = await db().execute(sql`
    SELECT ${a.all ? FULL_COLUMNS : COLUMNS}
    FROM bbforms_responses r ${a.all ? sql`LEFT JOIN users u ON u.id = r.user_id` : sql``}
    WHERE ${where}
    ORDER BY ${orderBy}, r.id DESC ${limit}`);
  const rows = rowsOf<Record<string, unknown>>(res).map((r) => format(r, !!a.all) as ResponseRecord);
  return { items: await attachValues(rows), total: Number(n) };
}

/** Deletes responses older than the retention period. Runs from the daily cron. */
export async function applyRetention(days: number): Promise<number> {
  if (days <= 0) return 0;
  const old = await db().execute(sql`SELECT id FROM bbforms_responses WHERE created_at < now() - (${days}::int * interval '1 day') LIMIT 5000`);
  return deleteResponses(rowsOf<{ id: number }>(old).map((r) => Number(r.id)));
}

/** Responses with an answer equal to this email, for GDPR export and erasure. */
export async function idsForEmail(email: string): Promise<number[]> {
  const res = await db().execute(sql`SELECT DISTINCT response_id FROM bbforms_answers WHERE lower(value) = ${email.trim().toLowerCase()} ORDER BY response_id`);
  return rowsOf<{ response_id: number }>(res).map((r) => Number(r.response_id));
}
