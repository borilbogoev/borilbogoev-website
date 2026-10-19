// Submission processing: sanitize, validate, spam protection, storage. Ported from class-bbf-submit.php.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { site } from "@/content/site";
import { CONTACT_FIELDS, isInput, logicVisible, type Block } from "./blocks";
import { cleanEmail, cleanMultiline, cleanText, cleanWebsite, isEmail } from "./sanitize";
import { BLOCKED_UPLOAD_EXTENSIONS, type GlobalSettings } from "./settings";
import type { Values } from "./responses";

/** Raw answers by field key (a list, so checkboxes can send several). */
export type RawAnswers = Record<string, string[]>;
export type RawFiles = Record<string, File>;

export type CollectResult = {
  values: Values;
  errors: Record<string, string>;
  /** Files that passed validation; they are stored after the whole submission is accepted. */
  uploads: Record<string, File>;
};

const first = (raw: RawAnswers, key: string) => (raw[key]?.[0] ?? "").toString();

/**
 * Collects and validates the answers of a form.
 * `strict` enforces required fields, formats and logic (false for edits made by an admin).
 */
export function collect(blocks: Block[], raw: RawAnswers, files: RawFiles, g: GlobalSettings, strict = true, today = new Date().toISOString().slice(0, 10)): CollectResult {
  const values: Values = {};
  const errors: Record<string, string> = {};
  const uploads: Record<string, File> = {};
  const req = g.label_required;

  for (const b of blocks) {
    const type = b.type;
    const s = b.settings;
    if (!isInput(type)) continue;
    if (s.logic && strict && !logicVisible(s.logic, values)) continue;

    if (type === "contact") {
      for (const [sub, cf] of Object.entries((s.fields ?? {}) as Record<string, { enabled: number; required: number; key: string }>)) {
        if (!cf.enabled) continue;
        const k = cf.key;
        const original = first(raw, k).trim();
        const subType = CONTACT_FIELDS[sub]?.[3] ?? "text";
        let v: string;
        if (subType === "email") {
          v = cleanEmail(original);
          if (strict && original !== "" && !isEmail(v)) errors[k] = "Please enter a valid email address.";
        } else if (subType === "url") {
          v = cleanWebsite(original);
        } else {
          v = cleanText(original);
        }
        if (strict && cf.required && v === "" && !errors[k]) errors[k] = req;
        values[k] = v;
      }
      continue;
    }

    const k = b.fieldKey;
    if (k === "") continue;
    const inList = raw[k] ?? [];
    const inText = inList[0] ?? "";
    let v: string | string[] = "";
    let err = "";

    switch (type) {
      case "long_text":
        v = cleanMultiline(inText);
        if (s.max_length > 0 && v.length > s.max_length) err = `Maximum ${s.max_length} characters.`;
        break;
      case "email":
        v = cleanEmail(inText);
        if (inText.trim() !== "" && !isEmail(v)) err = "Please enter a valid email address.";
        break;
      case "website":
        v = cleanWebsite(inText);
        break;
      case "number": {
        v = inText.trim().replace(",", ".");
        if (v !== "") {
          if (!/^-?\d+(\.\d+)?$/.test(v)) {
            err = "Please enter a number.";
            v = "";
          } else {
            v = String(Number(v));
            if (s.min !== "" && Number.isFinite(Number(s.min)) && Number(v) < Number(s.min)) err = `Minimum value is ${s.min}.`;
            if (s.max !== "" && Number.isFinite(Number(s.max)) && Number(v) > Number(s.max)) err = `Maximum value is ${s.max}.`;
          }
        }
        break;
      }
      case "date": {
        v = cleanText(inText, 20);
        if (v !== "") {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
            err = "Please enter a valid date.";
            v = "";
          } else {
            const min = s.min === "today" ? today : s.min;
            const max = s.max === "today" ? today : s.max;
            if (min && v < min) err = "This date is too early.";
            else if (max && v > max) err = "This date is too late.";
          }
        }
        break;
      }
      case "choice": {
        const opts: string[] = Array.isArray(s.options) ? s.options : [];
        const picks = inList.map((p) => cleanText(p)).filter((p) => p !== "");
        const clean: string[] = [];
        for (const p of picks) {
          if (opts.includes(p)) clean.push(p);
          else if (p === "__other" && s.allow_other) {
            const other = cleanText(first(raw, `${k}__other`));
            if (other) clean.push(other);
          } else if (!strict) clean.push(p);
        }
        if (!s.multiple) {
          v = clean[0] ?? "";
        } else {
          v = [...new Set(clean)];
          const n = v.length;
          if (n && s.min_select > 0 && n < s.min_select) err = `Please select at least ${s.min_select} options.`;
          if (s.max_select > 0 && n > s.max_select) err = `Please select up to ${s.max_select} options.`;
        }
        break;
      }
      case "dropdown":
        v = cleanText(inText);
        if (strict && v !== "" && !(s.options as string[]).includes(v)) v = "";
        break;
      case "yes_no":
        v = cleanText(inText);
        if (strict && v !== "" && ![s.yes_label, s.no_label].includes(v)) v = "";
        break;
      case "rating":
      case "scale": {
        v = inText.trim();
        const min = type === "rating" ? 1 : Number(s.min);
        if (v !== "" && (!/^-?\d+$/.test(v) || Number(v) < min || Number(v) > Number(s.max))) v = "";
        v = v === "" ? "" : String(Number.parseInt(v, 10));
        break;
      }
      case "consent":
        v = inText !== "" && inText !== "No" ? "Yes" : strict ? "No" : "";
        if (strict && s.required && v !== "Yes") err = "Please confirm to continue.";
        break;
      case "file": {
        v = typeof inText === "string" && inText.startsWith("/") ? inText : ""; // keeps an existing file when an admin edits
        const file = files[k];
        if (file && file.size > 0) {
          const problem = checkUpload(file, s as { types: string; max_mb: number }, g);
          if (problem) err = problem;
          else uploads[k] = file;
        }
        break;
      }
      default: {
        // hidden, phone, short_text
        v = cleanText(inText);
        if (type === "short_text" && s.max_length > 0 && v.length > s.max_length) err = `Maximum ${s.max_length} characters.`;
        if (type === "phone" && v !== "" && !/^[0-9 +().\-/]{5,30}$/.test(v)) err = "Please enter a valid phone number.";
      }
    }

    const empty = Array.isArray(v) ? v.length === 0 : v === "" || (type === "consent" && v !== "Yes");
    const hasUpload = type === "file" && !!uploads[k];
    if (strict && s.required && empty && !hasUpload && !err) err = req;
    if (strict && err) errors[k] = err;
    values[k] = v;
  }
  return { values, errors, uploads };
}

export function uploadLimits(s: { types?: string; max_mb?: number }, g: GlobalSettings) {
  const maxMb = Number(s.max_mb) > 0 ? Number(s.max_mb) : g.upload_max_mb;
  const types = (s.types || g.upload_types)
    .toLowerCase()
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return { maxMb, types };
}

function checkUpload(file: File, s: { types: string; max_mb: number }, g: GlobalSettings): string {
  const { maxMb, types } = uploadLimits(s, g);
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (file.size > maxMb * 1024 * 1024) return `File is too large (max ${maxMb} MB).`;
  if (!types.includes(ext) || BLOCKED_UPLOAD_EXTENSIONS.includes(ext)) return "This file type is not allowed.";
  return "";
}

/* -------------------------------------------------------------------------- */
/* Request helpers                                                            */
/* -------------------------------------------------------------------------- */

export function deviceOf(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|windows phone/.test(ua)) return "mobile";
  return ua ? "desktop" : "";
}

export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "";
}

/** IPv4: last octet zeroed. IPv6: only the first four groups kept. */
export function anonymizeIp(ip: string): string {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip.replace(/\.\d+$/, ".0");
  if (ip.includes(":")) {
    const [head, tail = ""] = ip.split("::");
    const h = head ? head.split(":") : [];
    const t = tail ? tail.split(":") : [];
    const groups = ip.includes("::") ? [...h, ...Array<string>(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t] : h;
    return `${groups.slice(0, 4).join(":")}::`;
  }
  return "";
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET is missing or shorter than 32 characters.");
  return s;
}

export const hashIp = (ip: string) => createHash("sha256").update(`${ip}${secret()}`).digest("hex");

/** Signed timestamp that proves when the form was loaded (bots that post instantly fail the minimum-seconds check). */
export function createToken(formId: number, now = Date.now()): string {
  const t = Math.floor(now / 1000);
  return `${t}.${createHmac("sha256", secret()).update(`bbf:${formId}:${t}`).digest("hex").slice(0, 24)}`;
}

/** Seconds since the token was issued, or -1 when it is not valid. */
export function tokenAge(formId: number, token: string, now = Date.now()): number {
  const [t, sig] = token.split(".");
  if (!t || !sig || !/^\d+$/.test(t)) return -1;
  const expected = createHmac("sha256", secret()).update(`bbf:${formId}:${t}`).digest("hex").slice(0, 24);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return -1;
  return Math.floor(now / 1000) - Number(t);
}

const META_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "referrer", "page_url", "page_title", "lang", "screen"];

export function cleanMeta(json: string): Record<string, string> {
  const meta: Record<string, string> = {};
  try {
    const m: unknown = JSON.parse(json);
    if (m && typeof m === "object") {
      for (const k of META_KEYS) {
        const v = (m as Record<string, unknown>)[k];
        if (typeof v === "string" && v !== "") meta[k] = cleanText(v, 500);
      }
    }
  } catch {
    // ignore malformed meta
  }
  return meta;
}

/** Traffic source: UTM source, else the referrer's host, else "direct". */
export function channelOf(meta: Record<string, string>): string {
  if (meta.utm_source) return meta.utm_source.toLowerCase();
  if (meta.referrer) {
    try {
      const url = new URL(meta.referrer);
      if (url.protocol !== "http:" && url.protocol !== "https:") return "direct"; // e.g. android-app://..., counted as direct, as before
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      const own = new URL(site.url).hostname.replace(/^www\./, "");
      return host === own ? "internal" : host;
    } catch {
      // not a URL at all
    }
  }
  return "direct";
}
