// Statistics intake. One request per page view and one per click, sent by the tiny Track component.
// Privacy: no cookies, no IP address stored. The visitor and the session are salted hashes of random ids kept in the visitor's browser.
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { db } from "@/db/use";
import { SESSION_COOKIE, verifySessionToken } from "@/modules/auth/session";
import { cleanText } from "@/modules/forms/lib/sanitize";
import { channelOf, deviceOf } from "@/modules/forms/lib/submit";
import { sanitizeLandingSettings, type LandingSettings } from "./settings";

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|monitor|uptime|curl|wget|python|node-fetch|axios|go-http|java\//i;

function salt() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET is missing or shorter than 32 characters.");
  return s;
}

const hash = (kind: string, value: string) => createHash("sha256").update(`${salt()}:${kind}:${value}`).digest("hex").slice(0, 32);

export function browserOf(ua: string): string {
  if (/instagram/i.test(ua)) return "Instagram app";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "Facebook app";
  if (/LinkedInApp/i.test(ua)) return "LinkedIn app";
  if (/TikTok|musical_ly/i.test(ua)) return "TikTok app";
  if (/SamsungBrowser/i.test(ua)) return "Samsung Internet";
  if (/Edg(e|A|iOS)?\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/Firefox|FxiOS/.test(ua)) return "Firefox";
  if (/Chrome|CriOS/.test(ua)) return "Chrome";
  if (/Safari/.test(ua)) return "Safari";
  return ua ? "Other" : "";
}

export function osOf(ua: string): string {
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Linux/.test(ua)) return "Linux";
  return ua ? "Other" : "";
}

type Cached = { status: string; settings: LandingSettings; at: number };
const cache = new Map<number, Cached>();

async function pageInfo(id: number): Promise<Cached | null> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < 60_000) return hit;
  const [row] = await db().select({ status: schema.landingPages.status, settings: schema.landingPages.settings }).from(schema.landingPages).where(eq(schema.landingPages.id, id)).limit(1);
  if (!row) return null;
  const info = { status: row.status, settings: sanitizeLandingSettings(row.settings), at: Date.now() };
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

type Body = { p?: unknown; t?: unknown; v?: unknown; s?: unknown; r?: unknown; q?: unknown; b?: unknown; bt?: unknown; l?: unknown; h?: unknown };

/** Stores one event. Returns quietly when the event should not be counted. */
export async function ingest(request: Request): Promise<void> {
  const raw = await request.text();
  if (raw.length > 4000) return;
  let body: Body;
  try {
    body = JSON.parse(raw) as Body;
  } catch {
    return;
  }
  const pageId = Number(body.p);
  const type = body.t;
  if (!Number.isInteger(pageId) || pageId <= 0 || (type !== "v" && type !== "c")) return;
  const v = String(body.v ?? "").slice(0, 80);
  const s = String(body.s ?? "").slice(0, 80);
  if (!v || !s) return;

  const ua = (request.headers.get("user-agent") ?? "").slice(0, 400);
  if (!ua || BOT.test(ua) || request.headers.get("sec-purpose")?.includes("prefetch")) return;

  const info = await pageInfo(pageId);
  if (!info || info.status !== "published" || !info.settings.track) return;
  if (info.settings.exclude_staff && (await verifySessionToken(cookie(request.headers.get("cookie"), SESSION_COOKIE)))) return;

  const visitorId = hash("v", v);
  const sessionId = hash("s", s);
  const d = db();

  if (type === "c") {
    const blockId = Math.trunc(Number(body.b));
    await d.insert(schema.landingClicks).values({
      pageId,
      visitorId,
      sessionId,
      blockId: Number.isInteger(blockId) && blockId > 0 ? blockId : null,
      blockType: cleanText(body.bt, 40),
      label: cleanText(body.l, 100),
      href: cleanText(body.h, 300),
    });
    return;
  }

  const params = new URLSearchParams(String(body.q ?? "").slice(0, 400));
  const meta: Record<string, string> = {};
  const utm = cleanText(params.get("utm_source"), 80);
  if (utm) meta.utm_source = utm;
  const ref = cleanText(body.r, 300);
  if (ref) meta.referrer = ref;
  await d.insert(schema.landingViews).values({
    pageId,
    visitorId,
    sessionId,
    device: deviceOf(ua),
    browser: browserOf(ua),
    os: osOf(ua),
    channel: channelOf(meta).slice(0, 80),
    medium: cleanText(params.get("utm_medium"), 60).toLowerCase(),
    campaign: cleanText(params.get("utm_campaign"), 100),
    country: (request.headers.get("x-vercel-ip-country") ?? "").slice(0, 2).toUpperCase(),
  });
}
