// Dashboard numbers of one landing page, and the totals shown on the list.
import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db/use";
import { getGlobalSettings } from "@/modules/forms/lib/settings-store";
import { addDays, bucketSql, buckets, todayIn, type Interval } from "@/modules/forms/lib/stats";
import { getPage } from "./pages";

export type Slice = { label: string; n: number };

export type LandingDashboard = {
  range: { from: string; to: string; interval: Interval };
  cards: {
    views: number;
    unique: number;
    sessions: number;
    clicks: number;
    clickers: number;
    /** clicks / views, in percent. */
    ctr: number | null;
    /** visitors who clicked / unique visitors, in percent. */
    uniqueCtr: number | null;
    submissions: number;
    /** form submissions / unique visitors, in percent. */
    conversion: number | null;
    prev: { views: number; unique: number; sessions: number; clicks: number };
    days: number;
    totalViews: number;
  };
  averages: { viewsPerDay: number; uniquePerDay: number; clicksPerDay: number; viewsPerVisitor: number | null; clicksPerSession: number | null; sessionsPerVisitor: number | null };
  timeline: { labels: string[]; views: number[]; unique: number[]; sessions: number[]; clicks: number[]; ctr: number[] };
  weekday: number[];
  hours: number[];
  devices: Slice[];
  browsers: Slice[];
  systems: Slice[];
  channels: Slice[];
  countries: Slice[];
  visitors: Slice[]; // new and returning
  clickShare: Slice[]; // clicks by button or link
  elements: { blockId: number | null; blockType: string; label: string; href: string; clicks: number; clickers: number; share: number; ctr: number | null }[];
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const round = (n: number, p = 1) => Math.round(n * 10 ** p) / 10 ** p;
const pct = (a: number, b: number) => (b ? round((a / b) * 100) : null);

function slices(rows: { label: string; n: number }[], max = 8): Slice[] {
  const out = rows.map((r) => ({ label: r.label || "unknown", n: Number(r.n) })).sort((a, b) => b.n - a.n);
  if (out.length <= max) return out;
  const rest = out.slice(max - 1).reduce((s, r) => s + r.n, 0);
  return [...out.slice(0, max - 1), { label: "Other", n: rest }];
}

export async function dashboard(pageId: number, fromIn?: string, toIn?: string, intervalIn?: string): Promise<LandingDashboard | null> {
  const page = await getPage(pageId);
  if (!page) return null;
  const tz = (await getGlobalSettings()).timezone;
  const d = db();

  let from = fromIn && DAY.test(fromIn) ? fromIn : "";
  if (!from) {
    const [first] = rowsOf<{ first: string | null }>(await d.execute(sql`SELECT to_char(MIN(created_at) AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS first FROM landing_views WHERE page_id = ${pageId}`));
    const created = todayIn(tz, page.createdAt);
    from = first?.first && first.first < created ? first.first : created;
  }
  let to = toIn && DAY.test(toIn) ? toIn : todayIn(tz);
  if (from > to) [from, to] = [to, from];
  const interval: Interval = intervalIn === "week" || intervalIn === "month" ? intervalIn : "day";
  const days = Math.max(1, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1);

  // Time window in the reporting time zone: [from 00:00, to + 1 day 00:00).
  const win = (alias: "v" | "c", a: string, b: string) =>
    sql`${sql.raw(alias)}.created_at >= (${a}::date)::timestamp AT TIME ZONE ${tz} AND ${sql.raw(alias)}.created_at < ((${b}::date) + 1)::timestamp AT TIME ZONE ${tz}`;
  const vWhere = sql`v.page_id = ${pageId} AND ${win("v", from, to)}`;
  const cWhere = sql`c.page_id = ${pageId} AND ${win("c", from, to)}`;
  const localV = sql`(v.created_at AT TIME ZONE ${tz})`;
  const localC = sql`(c.created_at AT TIME ZONE ${tz})`;

  const totals = async (a: string, b: string) => {
    const vw = sql`v.page_id = ${pageId} AND ${win("v", a, b)}`;
    const cw = sql`c.page_id = ${pageId} AND ${win("c", a, b)}`;
    const [v] = rowsOf<{ views: number; uniq: number; sessions: number }>(await d.execute(sql`SELECT COUNT(*)::int AS views, COUNT(DISTINCT v.visitor_id)::int AS uniq, COUNT(DISTINCT v.session_id)::int AS sessions FROM landing_views v WHERE ${vw}`));
    const [c] = rowsOf<{ clicks: number; clickers: number }>(await d.execute(sql`SELECT COUNT(*)::int AS clicks, COUNT(DISTINCT c.visitor_id)::int AS clickers FROM landing_clicks c WHERE ${cw}`));
    return { views: Number(v?.views ?? 0), unique: Number(v?.uniq ?? 0), sessions: Number(v?.sessions ?? 0), clicks: Number(c?.clicks ?? 0), clickers: Number(c?.clickers ?? 0) };
  };
  const cur = await totals(from, to);
  const prevT = await totals(addDays(from, -days), addDays(from, -1));
  const [all] = rowsOf<{ n: number }>(await d.execute(sql`SELECT COUNT(*)::int AS n FROM landing_views WHERE page_id = ${pageId}`));

  // Form submissions that came from this page (the form records the page address it was sent from).
  const [sub] = rowsOf<{ n: number }>(
    await d.execute(
      sql`SELECT COUNT(*)::int AS n FROM bbforms_responses r WHERE r.page_url ~ ${`/l/${page.slug}([?#/]|$)`} AND r.created_at >= (${from}::date)::timestamp AT TIME ZONE ${tz} AND r.created_at < ((${to}::date) + 1)::timestamp AT TIME ZONE ${tz}`,
    ),
  );
  const submissions = Number(sub?.n ?? 0);

  // Timeline.
  const labels = buckets(from, to, interval);
  const vrows = rowsOf<{ k: string; views: number; uniq: number; sessions: number }>(
    await d.execute(sql`SELECT ${bucketSql(localV, interval)} AS k, COUNT(*)::int AS views, COUNT(DISTINCT v.visitor_id)::int AS uniq, COUNT(DISTINCT v.session_id)::int AS sessions FROM landing_views v WHERE ${vWhere} GROUP BY k`),
  );
  const crows = rowsOf<{ k: string; clicks: number }>(await d.execute(sql`SELECT ${bucketSql(localC, interval)} AS k, COUNT(*)::int AS clicks FROM landing_clicks c WHERE ${cWhere} GROUP BY k`));
  const vm = new Map(vrows.map((r) => [r.k, r]));
  const cm = new Map(crows.map((r) => [r.k, Number(r.clicks)]));
  const timeline: LandingDashboard["timeline"] = { labels, views: [], unique: [], sessions: [], clicks: [], ctr: [] };
  for (const l of labels) {
    const v = Number(vm.get(l)?.views ?? 0);
    const c = cm.get(l) ?? 0;
    timeline.views.push(v);
    timeline.unique.push(Number(vm.get(l)?.uniq ?? 0));
    timeline.sessions.push(Number(vm.get(l)?.sessions ?? 0));
    timeline.clicks.push(c);
    timeline.ctr.push(v ? round((c / v) * 100) : 0);
  }

  const weekday = Array<number>(7).fill(0);
  for (const r of rowsOf<{ k: number; n: number }>(await d.execute(sql`SELECT (EXTRACT(ISODOW FROM ${localV}) - 1)::int AS k, COUNT(*)::int AS n FROM landing_views v WHERE ${vWhere} GROUP BY k`))) weekday[Number(r.k)] = Number(r.n);
  const hours = Array<number>(24).fill(0);
  for (const r of rowsOf<{ k: number; n: number }>(await d.execute(sql`SELECT EXTRACT(HOUR FROM ${localV})::int AS k, COUNT(*)::int AS n FROM landing_views v WHERE ${vWhere} GROUP BY k`))) hours[Number(r.k)] = Number(r.n);

  // Distributions are counted in visits (unique sessions), so one busy visitor does not skew them.
  const dist = async (col: string, fallback = "unknown") =>
    slices(
      rowsOf<{ label: string; n: number }>(await d.execute(sql`SELECT CASE WHEN v.${sql.raw(col)} = '' THEN ${fallback} ELSE v.${sql.raw(col)} END AS label, COUNT(DISTINCT v.session_id)::int AS n FROM landing_views v WHERE ${vWhere} GROUP BY label`)),
    );
  const [devices, browsers, systems, channels, countries] = [await dist("device"), await dist("browser"), await dist("os"), await dist("channel", "direct"), await dist("country")];

  const [nr] = rowsOf<{ fresh: number; ret: number }>(
    await d.execute(sql`
      WITH seen AS (SELECT v.visitor_id, MIN(v.created_at) AS first_seen FROM landing_views v WHERE v.page_id = ${pageId} GROUP BY v.visitor_id),
      inrange AS (SELECT DISTINCT v.visitor_id FROM landing_views v WHERE ${vWhere})
      SELECT COUNT(*) FILTER (WHERE s.first_seen >= (${from}::date)::timestamp AT TIME ZONE ${tz})::int AS fresh,
             COUNT(*) FILTER (WHERE s.first_seen < (${from}::date)::timestamp AT TIME ZONE ${tz})::int AS ret
      FROM inrange i JOIN seen s ON s.visitor_id = i.visitor_id`),
  );
  const visitors = [
    { label: "New visitors", n: Number(nr?.fresh ?? 0) },
    { label: "Returning visitors", n: Number(nr?.ret ?? 0) },
  ].filter((x) => x.n > 0);

  const el = rowsOf<{ block_id: number | null; block_type: string; label: string; href: string; n: number; u: number }>(
    await d.execute(sql`SELECT c.block_id, c.block_type, c.label, c.href, COUNT(*)::int AS n, COUNT(DISTINCT c.visitor_id)::int AS u FROM landing_clicks c WHERE ${cWhere} GROUP BY c.block_id, c.block_type, c.label, c.href ORDER BY n DESC LIMIT 40`),
  );
  const elements = el.map((r) => ({
    blockId: r.block_id === null ? null : Number(r.block_id),
    blockType: r.block_type,
    label: r.label || "(no label)",
    href: r.href,
    clicks: Number(r.n),
    clickers: Number(r.u),
    share: cur.clicks ? round((Number(r.n) / cur.clicks) * 100) : 0,
    ctr: pct(Number(r.n), cur.views),
  }));
  const byLabel = new Map<string, number>();
  for (const e of elements) byLabel.set(e.label, (byLabel.get(e.label) ?? 0) + e.clicks);
  const clickShare = slices([...byLabel].map(([label, n]) => ({ label, n })), 7);

  return {
    range: { from, to, interval },
    cards: {
      ...cur,
      ctr: pct(cur.clicks, cur.views),
      uniqueCtr: pct(cur.clickers, cur.unique),
      submissions,
      conversion: pct(submissions, cur.unique),
      prev: { views: prevT.views, unique: prevT.unique, sessions: prevT.sessions, clicks: prevT.clicks },
      days,
      totalViews: Number(all?.n ?? 0),
    },
    averages: {
      viewsPerDay: round(cur.views / days, 2),
      uniquePerDay: round(cur.unique / days, 2),
      clicksPerDay: round(cur.clicks / days, 2),
      viewsPerVisitor: cur.unique ? round(cur.views / cur.unique, 2) : null,
      clicksPerSession: cur.sessions ? round(cur.clicks / cur.sessions, 2) : null,
      sessionsPerVisitor: cur.unique ? round(cur.sessions / cur.unique, 2) : null,
    },
    timeline,
    weekday,
    hours,
    devices,
    browsers,
    systems,
    channels,
    countries,
    visitors,
    clickShare,
    elements,
  };
}

/** Totals of all pages for the last 30 days, shown on top of the list. */
export async function overview(): Promise<{ pages: number; published: number; views: number; unique: number; clicks: number; ctr: number | null }> {
  const d = db();
  const [p] = rowsOf<{ pages: number; published: number }>(await d.execute(sql`SELECT COUNT(*)::int AS pages, COUNT(*) FILTER (WHERE status = 'published')::int AS published FROM landing_pages`));
  const [v] = rowsOf<{ views: number; uniq: number }>(await d.execute(sql`SELECT COUNT(*)::int AS views, COUNT(DISTINCT visitor_id)::int AS uniq FROM landing_views WHERE created_at >= now() - interval '30 days'`));
  const [c] = rowsOf<{ clicks: number }>(await d.execute(sql`SELECT COUNT(*)::int AS clicks FROM landing_clicks WHERE created_at >= now() - interval '30 days'`));
  const views = Number(v?.views ?? 0);
  const clicks = Number(c?.clicks ?? 0);
  return { pages: Number(p?.pages ?? 0), published: Number(p?.published ?? 0), views, unique: Number(v?.uniq ?? 0), clicks, ctr: pct(clicks, views) };
}
