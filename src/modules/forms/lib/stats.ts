// Dashboard statistics and view / start tracking. Ported from class-bbf-stats.php.
import { sql, type SQL } from "drizzle-orm";
import { db, rowsOf } from "@/db/use";
import { fieldOptions, fieldsOf, isEmailField, BLOCK_TYPES, type Field } from "./blocks";
import { getBlocks, getForm } from "./forms";
import { countResponses, decodeValue, responsesWhere } from "./responses";
import { getGlobalSettings } from "./settings-store";

/** Today's date in a time zone, YYYY-MM-DD. */
export function todayIn(timeZone: string, at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

export async function track(formId: number, type: "view" | "start"): Promise<void> {
  const tz = (await getGlobalSettings()).timezone;
  const col = sql.raw(type === "start" ? "starts" : "views");
  await db().execute(sql`
    INSERT INTO bbforms_stats (form_id, day, ${col}) VALUES (${formId}, ${todayIn(tz)}::date, 1)
    ON CONFLICT (form_id, day) DO UPDATE SET ${col} = bbforms_stats.${col} + 1`);
}

export type Interval = "day" | "week" | "month";

type Bucketed = { key: string; n: number; d?: number | null };

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Bucket start dates between two days, matching the SQL bucket expressions. */
export function buckets(from: string, to: string, interval: Interval): string[] {
  const out: string[] = [];
  let t = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (interval === "week") t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  if (interval === "month") t = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
  let guard = 0;
  while (t <= end && guard++ < 1200) {
    out.push(t.toISOString().slice(0, 10));
    if (interval === "day") t.setUTCDate(t.getUTCDate() + 1);
    else if (interval === "week") t.setUTCDate(t.getUTCDate() + 7);
    else t = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1));
  }
  return out;
}

/** Start date of the bucket (day, ISO week or month) that a date or timestamp expression falls in. */
export const bucketSql = (expr: SQL, interval: Interval) =>
  interval === "day" ? sql`to_char((${expr})::date, 'YYYY-MM-DD')` : sql`to_char(date_trunc(${interval}, (${expr})::date)::date, 'YYYY-MM-DD')`;

export type ChartItem = { label: string; n: number; pct: number };
export type Chart = { key: string; label: string; type: string; answered: number; multiple: boolean; items: ChartItem[]; avg?: number | null; max?: number; nps?: number };

export type Dashboard = {
  range: { from: string; to: string; interval: Interval };
  cards: {
    responses: number;
    prev: number;
    views: number;
    starts: number;
    completion: number | null;
    conversion: number | null;
    avg_time: number;
    per_day: number;
    unique: number | null;
    total_all: number;
    days: number;
  };
  timeline: { labels: string[]; responses: number[]; views: number[]; starts: number[]; duration: number[]; cumulative: number[] };
  weekday: number[];
  hours: number[];
  devices: { label: string; n: number }[];
  channels: { label: string; n: number }[];
  rates: { label: string; key: string; n: number; pct: number }[];
  charts: Chart[];
  numbers: { key: string; label: string; unit: string; n: number; avg: number | null; min: number | null; max: number | null; sum: number | null }[];
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const round = (n: number, p = 1) => Math.round(n * 10 ** p) / 10 ** p;
const SAFE_NUM = `CASE WHEN a.value ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN a.value::numeric END`;

export async function dashboard(formId: number, fromIn: string | undefined, toIn: string | undefined, intervalIn: string | undefined): Promise<Dashboard | null> {
  const form = await getForm(formId);
  if (!form) return null;
  const tz = (await getGlobalSettings()).timezone;
  const d = db();

  let from = fromIn && DAY.test(fromIn) ? fromIn : "";
  if (!from) {
    const [first] = rowsOf<{ first: string | null }>(await d.execute(sql`SELECT to_char(MIN(created_at) AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS first FROM bbforms_responses WHERE form_id = ${formId}`));
    const created = todayIn(tz, form.createdAt);
    from = first?.first && first.first < created ? first.first : created;
  }
  let to = toIn && DAY.test(toIn) ? toIn : todayIn(tz);
  if (from > to) [from, to] = [to, from];
  const interval: Interval = intervalIn === "week" || intervalIn === "month" ? intervalIn : "day";

  const where = responsesWhere(formId, { from, to, timeZone: tz });
  const local = sql`(r.created_at AT TIME ZONE ${tz})`;
  const swhere = sql`form_id = ${formId} AND day BETWEEN ${from}::date AND ${to}::date`;

  const [tot] = rowsOf<{ n: number; d: string | null }>(await d.execute(sql`SELECT COUNT(*)::int AS n, AVG(NULLIF(duration, 0)) AS d FROM bbforms_responses r WHERE ${where}`));
  const [vs] = rowsOf<{ v: number; s: number }>(await d.execute(sql`SELECT COALESCE(SUM(views), 0)::int AS v, COALESCE(SUM(starts), 0)::int AS s FROM bbforms_stats WHERE ${swhere}`));

  const days = Math.max(1, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1);
  const prevWhere = responsesWhere(formId, { from: addDays(from, -days), to: addDays(from, -1), timeZone: tz });
  const [prev] = rowsOf<{ n: number }>(await d.execute(sql`SELECT COUNT(*)::int AS n FROM bbforms_responses r WHERE ${prevWhere}`));

  const fields = fieldsOf(await getBlocks(formId));
  const emailKeys = fields.filter(isEmailField).map((f) => f.key);
  let unique = 0;
  if (emailKeys.length) {
    const [u] = rowsOf<{ n: number }>(
      await d.execute(sql`SELECT COUNT(DISTINCT lower(a.value))::int AS n FROM bbforms_answers a JOIN bbforms_responses r ON r.id = a.response_id
        WHERE ${where} AND a.field_key IN (${sql.join(emailKeys.map((k) => sql`${k}`), sql`, `)}) AND a.value <> ''`),
    );
    unique = u?.n ?? 0;
  }

  const n = Number(tot?.n ?? 0);
  const views = Number(vs?.v ?? 0);
  const starts = Number(vs?.s ?? 0);
  const cards: Dashboard["cards"] = {
    responses: n,
    prev: Number(prev?.n ?? 0),
    views,
    starts,
    completion: starts ? round(Math.min(100, (n / starts) * 100)) : null,
    conversion: views ? round(Math.min(100, (n / views) * 100)) : null,
    avg_time: tot?.d ? Math.round(Number(tot.d)) : 0,
    per_day: round(n / days, 2),
    unique: emailKeys.length ? unique : null,
    total_all: await countResponses(formId),
    days,
  };

  // Timeline.
  const labels = buckets(from, to, interval);
  const rows = rowsOf<{ k: string; n: number; d: string | null }>(
    await d.execute(sql`SELECT ${bucketSql(local, interval)} AS k, COUNT(*)::int AS n, AVG(NULLIF(r.duration, 0)) AS d FROM bbforms_responses r WHERE ${where} GROUP BY k`),
  );
  const srows = rowsOf<{ k: string; v: number; s: number }>(
    await d.execute(sql`SELECT ${bucketSql(sql`day`, interval)} AS k, SUM(views)::int AS v, SUM(starts)::int AS s FROM bbforms_stats WHERE ${swhere} GROUP BY k`),
  );
  const map = new Map<string, Bucketed>(rows.map((r) => [r.k, { key: r.k, n: Number(r.n), d: r.d ? Number(r.d) : null }]));
  const smap = new Map(srows.map((r) => [r.k, r]));
  const timeline: Dashboard["timeline"] = { labels, responses: [], views: [], starts: [], duration: [], cumulative: [] };
  let cum = 0;
  for (const l of labels) {
    const c = map.get(l)?.n ?? 0;
    cum += c;
    timeline.responses.push(c);
    timeline.cumulative.push(cum);
    timeline.duration.push(map.get(l)?.d ? Math.round(map.get(l)!.d as number) : 0);
    timeline.views.push(Number(smap.get(l)?.v ?? 0));
    timeline.starts.push(Number(smap.get(l)?.s ?? 0));
  }

  // Weekday and hour distribution.
  const weekday = Array<number>(7).fill(0);
  for (const r of rowsOf<{ k: number; n: number }>(await d.execute(sql`SELECT (EXTRACT(ISODOW FROM ${local}) - 1)::int AS k, COUNT(*)::int AS n FROM bbforms_responses r WHERE ${where} GROUP BY k`))) weekday[Number(r.k)] = Number(r.n);
  const hours = Array<number>(24).fill(0);
  for (const r of rowsOf<{ k: number; n: number }>(await d.execute(sql`SELECT EXTRACT(HOUR FROM ${local})::int AS k, COUNT(*)::int AS n FROM bbforms_responses r WHERE ${where} GROUP BY k`))) hours[Number(r.k)] = Number(r.n);
  const devices = rowsOf<{ label: string; n: number }>(await d.execute(sql`SELECT CASE WHEN r.device = '' THEN 'unknown' ELSE r.device END AS label, COUNT(*)::int AS n FROM bbforms_responses r WHERE ${where} GROUP BY label ORDER BY n DESC`)).map((r) => ({ label: r.label, n: Number(r.n) }));
  const channels = rowsOf<{ label: string; n: number }>(await d.execute(sql`SELECT r.channel AS label, COUNT(*)::int AS n FROM bbforms_responses r WHERE ${where} GROUP BY label ORDER BY n DESC LIMIT 8`)).map((r) => ({ label: r.label, n: Number(r.n) }));

  // Answer rates.
  const answered = new Map<string, number>();
  if (fields.length && n) {
    const ans = rowsOf<{ k: string; n: number }>(
      await d.execute(sql`SELECT a.field_key AS k, COUNT(DISTINCT a.response_id)::int AS n FROM bbforms_answers a JOIN bbforms_responses r ON r.id = a.response_id
        WHERE ${where} AND a.value <> '' AND a.value <> '[]' GROUP BY a.field_key`),
    );
    for (const a of ans) answered.set(a.k, Number(a.n));
  }
  const rates: Dashboard["rates"] = [];
  if (fields.length && n) {
    for (const f of fields) {
      if (f.type === "hidden") continue;
      const c = answered.get(f.key) ?? 0;
      rates.push({ label: f.label, key: f.key, n: c, pct: round((c / n) * 100) });
    }
  }

  // Choice charts and numeric summaries.
  const chartFields = fields.filter((f) => f.type !== "contact" && BLOCK_TYPES[f.type].chart);
  const numFields = fields.filter((f) => f.type === "number");
  const charts: Chart[] = [];
  if (chartFields.length) {
    const vals = rowsOf<{ k: string; v: string; n: number }>(
      await d.execute(sql`SELECT a.field_key AS k, a.value AS v, COUNT(*)::int AS n FROM bbforms_answers a JOIN bbforms_responses r ON r.id = a.response_id
        WHERE ${where} AND a.field_key IN (${sql.join(chartFields.map((f) => sql`${f.key}`), sql`, `)}) AND a.value <> '' GROUP BY a.field_key, a.value`),
    );
    const cnt = new Map<string, Map<string, number>>();
    for (const v of vals) {
      const dec = decodeValue(v.v);
      for (const one of Array.isArray(dec) ? dec : [dec]) {
        if (one === "") continue;
        const m = cnt.get(v.k) ?? new Map<string, number>();
        m.set(one, (m.get(one) ?? 0) + Number(v.n));
        cnt.set(v.k, m);
      }
    }
    for (const f of chartFields) charts.push(buildChart(f, cnt.get(f.key) ?? new Map(), answered.get(f.key)));
  }
  const numbers: Dashboard["numbers"] = [];
  if (numFields.length) {
    const rs = rowsOf<Record<string, string | number | null>>(
      await d.execute(sql`SELECT a.field_key AS k, COUNT(*)::int AS n, AVG(${sql.raw(SAFE_NUM)}) AS av, MIN(${sql.raw(SAFE_NUM)}) AS mn, MAX(${sql.raw(SAFE_NUM)}) AS mx, SUM(${sql.raw(SAFE_NUM)}) AS sm
        FROM bbforms_answers a JOIN bbforms_responses r ON r.id = a.response_id
        WHERE ${where} AND a.field_key IN (${sql.join(numFields.map((f) => sql`${f.key}`), sql`, `)}) AND a.value <> '' GROUP BY a.field_key`),
    );
    const rm = new Map(rs.map((r) => [String(r.k), r]));
    for (const f of numFields) {
      const r = rm.get(f.key);
      const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
      numbers.push({ key: f.key, label: f.label, unit: String(f.block.settings.unit ?? ""), n: r ? Number(r.n) : 0, avg: r ? round(Number(r.av), 2) : null, min: r ? num(r.mn) : null, max: r ? num(r.mx) : null, sum: r ? round(Number(r.sm), 2) : null });
    }
  }

  return { range: { from, to, interval }, cards, timeline, weekday, hours, devices, channels, rates, charts, numbers };
}

function buildChart(f: Field, counts: Map<string, number>, answeredIn: number | undefined): Chart {
  const opts = fieldOptions(f);
  const c = new Map(counts);
  const base = answeredIn ?? [...c.values()].reduce((a, b) => a + b, 0);
  const items = new Map<string, number>();
  for (const o of opts) {
    items.set(o, c.get(o) ?? 0);
    c.delete(o);
  }
  if (c.size) {
    const sorted = [...c.entries()].sort((a, b) => b[1] - a[1]);
    let other = 0;
    for (const [label, num] of sorted) {
      if (items.size < opts.length + 5) items.set(label, num);
      else other += num;
    }
    if (other) items.set("Other answers", other);
  }
  const chart: Chart = {
    key: f.key,
    label: f.label,
    type: f.type,
    answered: base,
    multiple: f.type === "choice" && !!f.block.settings.multiple,
    items: [...items].map(([label, num]) => ({ label, n: num, pct: base ? round((num / base) * 100) : 0 })),
  };
  if (f.type === "rating" || f.type === "scale") {
    let sum = 0;
    let num = 0;
    for (const [label, cn] of items) {
      if (label !== "" && !Number.isNaN(Number(label))) {
        sum += Number(label) * cn;
        num += cn;
      }
    }
    chart.avg = num ? round(sum / num, 2) : null;
    const s = f.block.settings;
    chart.max = Number(s.max);
    if (f.type === "scale" && Number(s.min) === 0 && Number(s.max) === 10 && num) {
      let pro = 0;
      let det = 0;
      for (const [label, cn] of items) {
        if (Number.parseInt(label, 10) >= 9) pro += cn;
        else if (Number.parseInt(label, 10) <= 6) det += cn;
      }
      chart.nps = Math.round(((pro - det) / num) * 100);
    }
  }
  return chart;
}
