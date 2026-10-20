// Statistics intake. One request when a deck opens, one with the furthest slide and the time spent.
// Privacy: no cookies, no IP address stored. The visitor and the session are salted hashes of random ids kept in the visitor's browser.
import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { schema } from "@/db";
import { db } from "@/db/use";
import { SESSION_COOKIE, verifySessionToken } from "@/modules/auth/session";
import { cleanText } from "@/modules/forms/lib/sanitize";
import { channelOf, deviceOf } from "@/modules/forms/lib/submit";
import { browserOf, osOf } from "@/modules/landing/lib/track";
import { sanitizeDeckSettings, type DeckSettings } from "./settings";

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|monitor|uptime|curl|wget|python|node-fetch|axios|go-http|java\//i;

function salt() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET is missing or shorter than 32 characters.");
  return s;
}
const hash = (kind: string, value: string) => createHash("sha256").update(`${salt()}:${kind}:${value}`).digest("hex").slice(0, 32);

type Cached = { status: string; settings: DeckSettings; at: number };
const cache = new Map<number, Cached>();

async function deckInfo(id: number): Promise<Cached | null> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < 60_000) return hit;
  const [row] = await db().select({ status: schema.presentations.status, settings: schema.presentations.settings }).from(schema.presentations).where(eq(schema.presentations.id, id)).limit(1);
  if (!row) return null;
  const info = { status: row.status, settings: sanitizeDeckSettings(row.settings), at: Date.now() };
  cache.set(id, info);
  return info;
}

function cookie(header: string | null, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}

type Body = { p?: unknown; t?: unknown; v?: unknown; s?: unknown; m?: unknown; r?: unknown; q?: unknown; x?: unknown; d?: unknown };

/** Stores one event. Returns quietly when the event should not be counted. */
export async function ingest(request: Request): Promise<void> {
  const raw = await request.text();
  if (raw.length > 2000) return;
  let body: Body;
  try {
    body = JSON.parse(raw) as Body;
  } catch {
    return;
  }
  const deckId = Number(body.p);
  const type = body.t;
  if (!Number.isInteger(deckId) || deckId <= 0 || (type !== "v" && type !== "p")) return;
  const v = String(body.v ?? "").slice(0, 80);
  const s = String(body.s ?? "").slice(0, 80);
  if (!v || !s) return;

  const ua = (request.headers.get("user-agent") ?? "").slice(0, 400);
  if (!ua || BOT.test(ua) || request.headers.get("sec-purpose")?.includes("prefetch")) return;

  const info = await deckInfo(deckId);
  if (!info || info.status !== "active" || !info.settings.track) return;
  if (info.settings.exclude_staff && (await verifySessionToken(cookie(request.headers.get("cookie"), SESSION_COOKIE)))) return;

  const visitorId = hash("v", v);
  const sessionId = hash("s", s);
  const d = db();
  const T = schema.presentationViews;

  if (type === "p") {
    // Progress belongs to the latest opening of this tab. Values only ever grow.
    const reach = Math.max(1, Math.min(500, Math.trunc(Number(body.x)) || 1));
    const secs = Math.max(0, Math.min(14400, Math.trunc(Number(body.d)) || 0));
    const [last] = await d.select({ id: T.id }).from(T).where(and(eq(T.presentationId, deckId), eq(T.sessionId, sessionId))).orderBy(desc(T.id)).limit(1);
    if (last) await d.update(T).set({ maxSlide: sql`GREATEST(${T.maxSlide}, ${reach})`, seconds: sql`GREATEST(${T.seconds}, ${secs})` }).where(eq(T.id, last.id));
    return;
  }

  const params = new URLSearchParams(String(body.q ?? "").slice(0, 400));
  const meta: Record<string, string> = {};
  const utm = cleanText(params.get("utm_source"), 80);
  if (utm) meta.utm_source = utm;
  const ref = cleanText(body.r, 300);
  if (ref) meta.referrer = ref;
  await d.insert(T).values({
    presentationId: deckId,
    visitorId,
    sessionId,
    mode: body.m === "accordion" ? "accordion" : "slides",
    device: deviceOf(ua),
    browser: browserOf(ua),
    os: osOf(ua),
    channel: channelOf(meta).slice(0, 80),
    country: (request.headers.get("x-vercel-ip-country") ?? "").slice(0, 2).toUpperCase(),
  });
}
