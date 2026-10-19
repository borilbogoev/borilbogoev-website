// Small input cleaners. They replace the WordPress sanitize_* helpers the plugin relied on.
// Output is always escaped by React (or by our own markdown renderer), so these only normalise input.

const TAGS = /<\/?[a-z!][^>]*>/gi;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** One line of plain text: tags removed, whitespace collapsed. */
export function cleanText(v: unknown, max = 5000): string {
  if (v === null || v === undefined || typeof v === "object") return "";
  return String(v).replace(TAGS, "").replace(CONTROL, "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Plain text that keeps line breaks. */
export function cleanMultiline(v: unknown, max = 20000): string {
  if (v === null || v === undefined || typeof v === "object") return "";
  return String(v)
    .replace(/\r\n?/g, "\n")
    .replace(TAGS, "")
    .replace(CONTROL, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export function cleanHexColor(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) ? s : "";
}

const EMAIL = /^[^\s@,;<>()[\]\\]+@[^\s@,;<>()[\]\\]+\.[^\s@,;<>()[\]\\]{2,}$/;

export function isEmail(v: string): boolean {
  return v.length <= 254 && EMAIL.test(v);
}

/** A valid email or an empty string. */
export function cleanEmail(v: unknown): string {
  const s = cleanText(v, 254);
  return isEmail(s) ? s : "";
}

/** Comma separated list of valid emails. */
export function cleanEmailList(v: unknown): string {
  return String(v ?? "")
    .split(",")
    .map((e) => cleanEmail(e))
    .filter(Boolean)
    .join(", ");
}

/** An http(s) URL, a site-relative path or an empty string. */
export function cleanUrl(v: unknown, allowRelative = true): string {
  const s = cleanText(v, 2000);
  if (!s) return "";
  if (allowRelative && s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\")) return s;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

/** A website typed by a visitor: adds https:// when the scheme is missing. */
export function cleanWebsite(v: unknown): string {
  const s = cleanText(v, 2000);
  if (!s) return "";
  return cleanUrl(/^https?:\/\//i.test(s) ? s : `https://${s}`, false);
}

/** Program name: lowercase letters, numbers and underscores. */
export function cleanKey(v: unknown): string {
  let k = String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (k && /^[0-9]/.test(k)) k = `f_${k}`;
  return k.slice(0, 100);
}

/** URL slug for /s/<slug>. */
export function cleanSlug(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function toInt(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function toBool(v: unknown): boolean {
  return v === true || v === 1 || v === "1" || v === "true" || v === "on";
}
