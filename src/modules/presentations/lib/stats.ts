// Dashboard numbers: one deck, and the whole library.
import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db/use";
import { getGlobalSettings } from "@/modules/forms/lib/settings-store";
import { addDays, bucketSql, buckets, todayIn, type Interval } from "@/modules/forms/lib/stats";
import { SLIDE_KINDS, isSlideKind } from "./slides";
import { ELEMENTS, isElementType } from "./elements";
import { getDeck } from "./presentations";

export type Slice = { label: string; n: number };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const round = (n: number, p = 1) => Math.round(n * 10 ** p) / 10 ** p;
const pct = (a: number, b: number) => (b ? round((a / b) * 100) : null);

function slices(rows: { label: string; n: number }[], max = 8): Slice[] {
  const out = rows.map((r) => ({ label: r.label || "unknown", n: Number(r.n) })).sort((a, b) => b.n - a.n);
  if (out.length <= max) return out;
  const rest = out.slice(max - 1).reduce((s, r) => s + r.n, 0);
  return [...out.slice(0, max - 1), { label: "Other", n: rest }];
}

/* -------------------------------------------------------------------------- */
/* One deck                                                                   */
/* -------------------------------------------------------------------------- */

export type DeckDashboard = {
  range: { from: string; to: string; interval: Interval };
  slides: number;
  cards: {
    views: number;
    unique: number;
    sessions: number;
    /** Average furthest slide reached, 1 = the first. */
    avgReach: number | null;
    /** Views that reached the last slide / views, in percent. */
    completion: number | null;
    avgSeconds: number | null;
    prev: { views: number; unique: number; sessions: number };
    days: number;
    totalViews: number;
  };
  averages: { viewsPerDay: number; uniquePerDay: number; viewsPerVisitor: number | null; sessionsPerVisitor: number | null };
  timeline: { labels: string[]; views: number[]; unique: number[]; sessions: number[] };
  weekday: number[];
  hours: number[];
  /** Views that reached slide n, for n = 1..slides: where the audience leaves. */
  funnel: number[];
  modes: Slice[];
  devices: Slice[];
  browsers: Slice[];
  systems: Slice[];
  channels: Slice[];
  countries: Slice[];
  visitors: Slice[];
};

export async function dashboard(deckId: number, fromIn?: string, toIn?: string, intervalIn?: string): Promise<DeckDashboard | null> {
  const deck = await getDeck(deckId);
  if (!deck) return null;
  const tz = (await getGlobalSettings()).timezone;
  const d = db();

  let from = fromIn && DAY.test(fromIn) ? fromIn : "";
  if (!from) {
    const [first] = rowsOf<{ first: string | null }>(await d.execute(sql`SELECT to_char(MIN(created_at) AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS first FROM presentation_views WHERE presentation_id = ${deckId}`));
    const created = todayIn(tz, deck.createdAt);
    from = first?.first && first.first < created ? first.first : created;
  }
  let to = toIn && DAY.test(toIn) ? toIn : todayIn(tz);
  if (from > to) [from, to] = [to, from];
  const interval: Interval = intervalIn === "week" || intervalIn === "month" ? intervalIn : "day";
  const days = Math.max(1, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1);

  const win = (a: string, b: string) => sql`v.created_at >= (${a}::date)::timestamp AT TIME ZONE ${tz} AND v.created_at < ((${b}::date) + 1)::timestamp AT TIME ZONE ${tz}`;
  const where = sql`v.presentation_id = ${deckId} AND ${win(from, to)}`;
  const local = sql`(v.created_at AT TIME ZONE ${tz})`;

  const [{ n: slideCount }] = rowsOf<{ n: number }>(await d.execute(sql`SELECT COUNT(*)::int AS n FROM presentation_slides s WHERE s.presentation_id = ${deckId} AND COALESCE((s.settings->>'hidden')::int, 0) = 0`));
  const slides = Number(slideCount);

  const totals = async (a: string, b: string) => {
    const w = sql`v.presentation_id = ${deckId} AND ${win(a, b)}`;
    const [r] = rowsOf<{ views: number; uniq: number; sessions: number; reach: string | null; done: number; secs: string | null }>(
      await d.execute(sql`SELECT COUNT(*)::int AS views, COUNT(DISTINCT v.visitor_id)::int AS uniq, COUNT(DISTINCT v.session_id)::int AS sessions,
        AVG(v.max_slide) AS reach, COUNT(*) FILTER (WHERE ${slides} > 0 AND v.max_slide >= ${slides})::int AS done, AVG(NULLIF(v.seconds, 0)) AS secs FROM presentation_views v WHERE ${w}`),
    );
    return { views: Number(r?.views ?? 0), unique: Number(r?.uniq ?? 0), sessions: Number(r?.sessions ?? 0), reach: r?.reach === null || r?.reach === undefined ? null : Number(r.reach), done: Number(r?.done ?? 0), secs: r?.secs === null || r?.secs === undefined ? null : Number(r.secs) };
  };
  const cur = await totals(from, to);
  const prevT = await totals(addDays(from, -days), addDays(from, -1));
  const [all] = rowsOf<{ n: number }>(await d.execute(sql`SELECT COUNT(*)::int AS n FROM presentation_views WHERE presentation_id = ${deckId}`));

  const labels = buckets(from, to, interval);
  const rows = rowsOf<{ k: string; views: number; uniq: number; sessions: number }>(
    await d.execute(sql`SELECT ${bucketSql(local, interval)} AS k, COUNT(*)::int AS views, COUNT(DISTINCT v.visitor_id)::int AS uniq, COUNT(DISTINCT v.session_id)::int AS sessions FROM presentation_views v WHERE ${where} GROUP BY k`),
  );
  const byKey = new Map(rows.map((r) => [r.k, r]));
  const timeline: DeckDashboard["timeline"] = { labels, views: [], unique: [], sessions: [] };
  for (const l of labels) {
    timeline.views.push(Number(byKey.get(l)?.views ?? 0));
    timeline.unique.push(Number(byKey.get(l)?.uniq ?? 0));
    timeline.sessions.push(Number(byKey.get(l)?.sessions ?? 0));
  }

  const weekday = Array<number>(7).fill(0);
  for (const r of rowsOf<{ k: number; n: number }>(await d.execute(sql`SELECT (EXTRACT(ISODOW FROM ${local}) - 1)::int AS k, COUNT(*)::int AS n FROM presentation_views v WHERE ${where} GROUP BY k`))) weekday[Number(r.k)] = Number(r.n);
  const hours = Array<number>(24).fill(0);
  for (const r of rowsOf<{ k: number; n: number }>(await d.execute(sql`SELECT EXTRACT(HOUR FROM ${local})::int AS k, COUNT(*)::int AS n FROM presentation_views v WHERE ${where} GROUP BY k`))) hours[Number(r.k)] = Number(r.n);

  const funnel: number[] = [];
  if (slides > 0) {
    const f = rowsOf<{ g: number; n: number }>(
      await d.execute(sql`SELECT g::int AS g, COUNT(v.id) FILTER (WHERE v.max_slide >= g)::int AS n FROM generate_series(1, ${Math.min(slides, 200)}) g LEFT JOIN presentation_views v ON ${where} GROUP BY g ORDER BY g`),
    );
    for (const r of f) funnel.push(Number(r.n));
  }

  const dist = async (col: string, fallback = "unknown") =>
    slices(rowsOf<{ label: string; n: number }>(await d.execute(sql`SELECT CASE WHEN v.${sql.raw(col)} = '' THEN ${fallback} ELSE v.${sql.raw(col)} END AS label, COUNT(DISTINCT v.session_id)::int AS n FROM presentation_views v WHERE ${where} GROUP BY label`)));
  const [devices, browsers, systems, channels, countries, modes] = [await dist("device"), await dist("browser"), await dist("os"), await dist("channel", "direct"), await dist("country"), await dist("mode")];

  const [nr] = rowsOf<{ fresh: number; ret: number }>(
    await d.execute(sql`
      WITH seen AS (SELECT v.visitor_id, MIN(v.created_at) AS first_seen FROM presentation_views v WHERE v.presentation_id = ${deckId} GROUP BY v.visitor_id),
      inrange AS (SELECT DISTINCT v.visitor_id FROM presentation_views v WHERE ${where})
      SELECT COUNT(*) FILTER (WHERE s.first_seen >= (${from}::date)::timestamp AT TIME ZONE ${tz})::int AS fresh,
             COUNT(*) FILTER (WHERE s.first_seen < (${from}::date)::timestamp AT TIME ZONE ${tz})::int AS ret
      FROM inrange i JOIN seen s ON s.visitor_id = i.visitor_id`),
  );
  const visitors = [
    { label: "New viewers", n: Number(nr?.fresh ?? 0) },
    { label: "Returning viewers", n: Number(nr?.ret ?? 0) },
  ].filter((x) => x.n > 0);

  return {
    range: { from, to, interval },
    slides,
    cards: {
      views: cur.views,
      unique: cur.unique,
      sessions: cur.sessions,
      avgReach: cur.reach === null ? null : round(cur.reach),
      completion: pct(cur.done, cur.views),
      avgSeconds: cur.secs === null ? null : Math.round(cur.secs),
      prev: { views: prevT.views, unique: prevT.unique, sessions: prevT.sessions },
      days,
      totalViews: Number(all?.n ?? 0),
    },
    averages: {
      viewsPerDay: round(cur.views / days, 2),
      uniquePerDay: round(cur.unique / days, 2),
      viewsPerVisitor: cur.unique ? round(cur.views / cur.unique, 2) : null,
      sessionsPerVisitor: cur.unique ? round(cur.sessions / cur.unique, 2) : null,
    },
    timeline,
    weekday,
    hours,
    funnel,
    modes,
    devices,
    browsers,
    systems,
    channels,
    countries,
    visitors,
  };
}

/* -------------------------------------------------------------------------- */
/* The library                                                                */
/* -------------------------------------------------------------------------- */

/** Totals shown on top of the list. */
export async function overview(): Promise<{ decks: number; active: number; slides: number; avgSlides: number | null; views: number; unique: number }> {
  const d = db();
  const [p] = rowsOf<{ decks: number; active: number; slides: number }>(
    await d.execute(sql`SELECT (SELECT COUNT(*) FROM presentations WHERE status <> 'archived')::int AS decks, (SELECT COUNT(*) FROM presentations WHERE status = 'active')::int AS active, (SELECT COUNT(*) FROM presentation_slides s JOIN presentations p ON p.id = s.presentation_id WHERE p.status <> 'archived')::int AS slides`),
  );
  const [v] = rowsOf<{ views: number; uniq: number }>(await d.execute(sql`SELECT COUNT(*)::int AS views, COUNT(DISTINCT visitor_id)::int AS uniq FROM presentation_views WHERE created_at >= now() - interval '30 days'`));
  const decks = Number(p?.decks ?? 0);
  const slides = Number(p?.slides ?? 0);
  return { decks, active: Number(p?.active ?? 0), slides, avgSlides: decks ? round(slides / decks) : null, views: Number(v?.views ?? 0), unique: Number(v?.uniq ?? 0) };
}

export type LibraryDashboard = {
  decks: number;
  byStatus: Slice[];
  slides: number;
  elements: number;
  avgSlides: number | null;
  medianSlides: number | null;
  maxSlides: number;
  avgElements: number | null;
  protectedDecks: number;
  withoutSlides: number;
  byMode: Slice[];
  byOrientation: Slice[];
  byCategory: Slice[];
  topTags: Slice[];
  kinds: Slice[];
  elementTypes: Slice[];
  views30: number;
  unique30: number;
  avgReach30: number | null;
  timeline: { labels: string[]; views: number[] };
  top: { id: number; title: string; slug: string; views: number; unique: number; avgReach: number | null }[];
  recent: { id: number; title: string; slug: string; status: string; slides: number; updatedAt: string }[];
};

const STATUS_NAMES: Record<string, string> = { draft: "Draft", active: "Active", inactive: "Inactive", archived: "Archived" };

export async function libraryDashboard(): Promise<LibraryDashboard> {
  const tz = (await getGlobalSettings()).timezone;
  const d = db();
  const [a] = rowsOf<Record<string, string | number | null>>(
    await d.execute(sql`SELECT
      (SELECT COUNT(*) FROM presentations)::int AS decks,
      (SELECT COUNT(*) FROM presentation_slides)::int AS slides,
      (SELECT COUNT(*) FROM presentation_elements)::int AS elements,
      (SELECT COUNT(*) FROM presentations WHERE password_hash IS NOT NULL)::int AS protected,
      (SELECT COUNT(*) FROM presentations p WHERE NOT EXISTS (SELECT 1 FROM presentation_slides s WHERE s.presentation_id = p.id))::int AS empty,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY c) FROM (SELECT COUNT(s.id) AS c FROM presentations p LEFT JOIN presentation_slides s ON s.presentation_id = p.id GROUP BY p.id) t) AS median,
      (SELECT MAX(c) FROM (SELECT COUNT(s.id) AS c FROM presentations p LEFT JOIN presentation_slides s ON s.presentation_id = p.id GROUP BY p.id) t)::int AS max`),
  );
  const decks = Number(a?.decks ?? 0);
  const slides = Number(a?.slides ?? 0);
  const elements = Number(a?.elements ?? 0);

  const group = async (q: ReturnType<typeof sql>) => rowsOf<{ label: string; n: number }>(await d.execute(q));
  const byStatus = (await group(sql`SELECT status AS label, COUNT(*)::int AS n FROM presentations GROUP BY status`)).map((r) => ({ label: STATUS_NAMES[r.label] ?? r.label, n: Number(r.n) }));
  const byMode = (await group(sql`SELECT mode AS label, COUNT(*)::int AS n FROM presentations GROUP BY mode`)).map((r) => ({ label: r.label === "accordion" ? "Accordion" : "Slides", n: Number(r.n) }));
  const byOrientation = (await group(sql`SELECT orientation AS label, COUNT(*)::int AS n FROM presentations GROUP BY orientation`)).map((r) => ({ label: r.label.charAt(0).toUpperCase() + r.label.slice(1), n: Number(r.n) }));
  const byCategory = slices(await group(sql`SELECT COALESCE(c.name, 'No category') AS label, COUNT(*)::int AS n FROM presentations p LEFT JOIN presentation_categories c ON c.id = p.category_id GROUP BY label`));
  const topTags = slices(await group(sql`SELECT t.name AS label, COUNT(*)::int AS n FROM presentation_tag_links l JOIN presentation_tags t ON t.id = l.tag_id GROUP BY t.name`), 8);
  const kinds = slices((await group(sql`SELECT kind AS label, COUNT(*)::int AS n FROM presentation_slides GROUP BY kind`)).map((r) => ({ label: isSlideKind(r.label) ? SLIDE_KINDS[r.label].label : r.label, n: r.n })), 10);
  const elementTypes = slices((await group(sql`SELECT type AS label, COUNT(*)::int AS n FROM presentation_elements GROUP BY type`)).map((r) => ({ label: isElementType(r.label) ? ELEMENTS[r.label].label : r.label, n: r.n })), 10);

  const [v] = rowsOf<{ views: number; uniq: number; reach: string | null }>(await d.execute(sql`SELECT COUNT(*)::int AS views, COUNT(DISTINCT visitor_id)::int AS uniq, AVG(max_slide) AS reach FROM presentation_views WHERE created_at >= now() - interval '30 days'`));
  const to = todayIn(tz);
  const from = addDays(to, -29);
  const labels = buckets(from, to, "day");
  const tl = new Map(
    rowsOf<{ k: string; n: number }>(await d.execute(sql`SELECT to_char(created_at AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS k, COUNT(*)::int AS n FROM presentation_views WHERE created_at >= (${from}::date)::timestamp AT TIME ZONE ${tz} GROUP BY k`)).map((r) => [r.k, Number(r.n)]),
  );

  const top = rowsOf<Record<string, unknown>>(
    await d.execute(sql`SELECT p.id, p.title, p.slug, COUNT(v.id)::int AS views, COUNT(DISTINCT v.visitor_id)::int AS uniq, AVG(v.max_slide) AS reach FROM presentations p JOIN presentation_views v ON v.presentation_id = p.id WHERE v.created_at >= now() - interval '30 days' GROUP BY p.id ORDER BY views DESC LIMIT 8`),
  ).map((r) => ({ id: Number(r.id), title: String(r.title), slug: String(r.slug), views: Number(r.views), unique: Number(r.uniq), avgReach: r.reach === null ? null : round(Number(r.reach)) }));
  const recent = rowsOf<Record<string, unknown>>(
    await d.execute(sql`SELECT p.id, p.title, p.slug, p.status, p.updated_at, (SELECT COUNT(*) FROM presentation_slides s WHERE s.presentation_id = p.id)::int AS slides FROM presentations p ORDER BY p.updated_at DESC LIMIT 6`),
  ).map((r) => ({ id: Number(r.id), title: String(r.title), slug: String(r.slug), status: String(r.status), slides: Number(r.slides), updatedAt: new Date(r.updated_at as string).toISOString() }));

  return {
    decks,
    byStatus,
    slides,
    elements,
    avgSlides: decks ? round(slides / decks) : null,
    medianSlides: a?.median === null || a?.median === undefined ? null : round(Number(a.median)),
    maxSlides: Number(a?.max ?? 0),
    avgElements: slides ? round(elements / slides) : null,
    protectedDecks: Number(a?.protected ?? 0),
    withoutSlides: Number(a?.empty ?? 0),
    byMode,
    byOrientation,
    byCategory,
    topTags,
    kinds,
    elementTypes,
    views30: Number(v?.views ?? 0),
    unique30: Number(v?.uniq ?? 0),
    avgReach30: v?.reach === null || v?.reach === undefined ? null : round(Number(v.reach)),
    timeline: { labels, views: labels.map((l) => tl.get(l) ?? 0) },
    top,
    recent,
  };
}
