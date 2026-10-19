// Form settings and global settings: defaults and sanitizing. Pure, shared by the server and the admin UI.
import { cleanEmailList, cleanHexColor, cleanKey, cleanMultiline, cleanText, cleanUrl, toBool, toInt } from "./sanitize";

/* -------------------------------------------------------------------------- */
/* Per-form settings                                                          */
/* -------------------------------------------------------------------------- */

export type FormSettings = {
  description: string;
  page_title: string; // <title> of the /s/<slug> page; empty uses the form name
  mode: "" | "classic" | "conversational";
  theme: "" | "light" | "dark";
  accent: string;
  max_width: number;
  progress: number;
  page_numbers: number;
  submit_label: string;
  next_label: string;
  prev_label: string;
  after_submit: "message" | "page" | "url";
  thankyou_message: string;
  thankyou_page: string; // site path such as /thank-you
  redirect_url: string;
  pass_params: number;
  notify_admin: number;
  notify_to: string;
  notify_subject: string;
  notify_body: string;
  autoresponder: number;
  auto_email_field: string;
  auto_subject: string;
  auto_body: string;
  open_at: string; // YYYY-MM-DD HH:mm in the forms timezone
  close_at: string;
  max_responses: number;
  closed_message: string;
  require_login: number;
  one_per_visitor: number;
  webhook_enabled: number;
  webhook_url: string;
  webhook_secret: string;
};

export const FORM_STATUSES = ["active", "draft", "closed"] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export function formSettingsDefaults(): FormSettings {
  return {
    description: "",
    page_title: "",
    mode: "",
    theme: "",
    accent: "",
    max_width: 720,
    progress: 1,
    page_numbers: 1,
    submit_label: "",
    next_label: "",
    prev_label: "",
    after_submit: "message",
    thankyou_message: "",
    thankyou_page: "",
    redirect_url: "",
    pass_params: 0,
    notify_admin: 1,
    notify_to: "",
    notify_subject: "New response #{response_seq} to {form_title}",
    notify_body: "You received a new response.\n\n{all_fields}",
    autoresponder: 0,
    auto_email_field: "",
    auto_subject: "Thank you for your response",
    auto_body: "Hi {first_name},\n\nThank you, we have received your response.\n\n{all_fields}",
    open_at: "",
    close_at: "",
    max_responses: 0,
    closed_message: "",
    require_login: 0,
    one_per_visitor: 0,
    webhook_enabled: 0,
    webhook_url: "",
    webhook_secret: "",
  };
}

const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);

function cleanDateTime(v: unknown): string {
  const s = cleanText(v, 40).replace("T", " ");
  return /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?/.test(s) ? s.slice(0, 16) : "";
}

/** Saved settings (possibly from an old version) laid over the defaults, then sanitized. */
export function sanitizeFormSettings(input: unknown): FormSettings {
  const d = formSettingsDefaults();
  const s = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const has = (k: keyof FormSettings) => s[k] !== undefined && s[k] !== null;
  const text = (k: keyof FormSettings) => (has(k) ? cleanText(s[k]) : (d[k] as string));
  const multi = (k: keyof FormSettings) => (has(k) ? cleanMultiline(s[k]) : (d[k] as string));
  const flag = (k: keyof FormSettings) => (has(k) ? (toBool(s[k]) ? 1 : 0) : (d[k] as number));
  const int = (k: keyof FormSettings) => (has(k) ? Math.max(0, toInt(s[k])) : (d[k] as number));
  return {
    description: multi("description"),
    page_title: text("page_title"),
    mode: oneOf(s.mode, ["", "classic", "conversational"], ""),
    theme: oneOf(s.theme, ["", "light", "dark"], ""),
    accent: cleanHexColor(s.accent),
    max_width: Math.min(1600, Math.max(320, int("max_width"))),
    progress: flag("progress"),
    page_numbers: flag("page_numbers"),
    submit_label: text("submit_label"),
    next_label: text("next_label"),
    prev_label: text("prev_label"),
    after_submit: oneOf(s.after_submit, ["message", "page", "url"], "message"),
    thankyou_message: multi("thankyou_message"),
    thankyou_page: cleanUrl(s.thankyou_page),
    redirect_url: cleanUrl(s.redirect_url, false),
    pass_params: flag("pass_params"),
    notify_admin: flag("notify_admin"),
    notify_to: has("notify_to") ? cleanEmailList(s.notify_to) : "",
    notify_subject: text("notify_subject"),
    notify_body: multi("notify_body"),
    autoresponder: flag("autoresponder"),
    auto_email_field: cleanKey(s.auto_email_field),
    auto_subject: text("auto_subject"),
    auto_body: multi("auto_body"),
    open_at: cleanDateTime(s.open_at),
    close_at: cleanDateTime(s.close_at),
    max_responses: int("max_responses"),
    closed_message: multi("closed_message"),
    require_login: flag("require_login"),
    one_per_visitor: flag("one_per_visitor"),
    webhook_enabled: flag("webhook_enabled"),
    webhook_url: cleanUrl(s.webhook_url, false),
    webhook_secret: text("webhook_secret"),
  };
}

/* -------------------------------------------------------------------------- */
/* Global settings (Forms > Settings)                                         */
/* -------------------------------------------------------------------------- */

export type GlobalSettings = {
  // Appearance
  accent_color: string;
  text_color: string;
  font_family: "inter" | "inherit" | "system";
  radius: number;
  default_theme: "light" | "dark";
  default_mode: "classic" | "conversational";
  // Labels
  label_submit: string;
  label_next: string;
  label_prev: string;
  label_required: string;
  thankyou_message: string;
  closed_message: string;
  // Email
  email_from_name: string;
  email_from: string;
  email_admin: string;
  // Security
  honeypot: number;
  min_seconds: number;
  rate_limit: number;
  ip_mode: "full" | "anonymized" | "none";
  store_user_agent: number;
  // Uploads
  upload_max_mb: number;
  upload_types: string;
  // Data
  track_views: number;
  retention_days: number;
  csv_delimiter: "," | ";" | "tab";
  timezone: string;
};

export function globalDefaults(): GlobalSettings {
  return {
    accent_color: "#D62B2B",
    text_color: "#111111",
    font_family: "inter",
    radius: 14,
    default_theme: "light",
    default_mode: "classic",
    label_submit: "Submit",
    label_next: "Next",
    label_prev: "Previous",
    label_required: "This field is required.",
    thankyou_message: "## Thank you!\n\nYour response has been recorded.",
    closed_message: "This form is currently not accepting responses.",
    email_from_name: "Boril Bogoev",
    email_from: process.env.INQUIRY_FROM_EMAIL?.match(/<([^>]+)>/)?.[1] ?? process.env.INQUIRY_FROM_EMAIL ?? "",
    email_admin: process.env.INQUIRY_TO_EMAIL ?? "",
    honeypot: 1,
    min_seconds: 3,
    rate_limit: 20,
    ip_mode: "anonymized",
    store_user_agent: 1,
    upload_max_mb: 5,
    upload_types: "jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,csv,txt,zip",
    track_views: 1,
    retention_days: 0,
    csv_delimiter: ",",
    timezone: "UTC",
  };
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const GLOBAL_BOOLS = ["honeypot", "store_user_agent", "track_views"] as const;
const GLOBAL_INTS = ["radius", "min_seconds", "rate_limit", "upload_max_mb", "retention_days"] as const;

/** Sanitize a full or partial global settings object; unknown keys are dropped. */
export function sanitizeGlobalSettings(input: unknown, base: GlobalSettings = globalDefaults()): GlobalSettings {
  const s = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const d = globalDefaults();
  const out: GlobalSettings = { ...base };
  const set = <K extends keyof GlobalSettings>(k: K, v: GlobalSettings[K]) => {
    out[k] = v;
  };
  for (const k of GLOBAL_BOOLS) if (k in s) set(k, toBool(s[k]) ? 1 : 0);
  for (const k of GLOBAL_INTS) if (k in s) set(k, Math.max(0, toInt(s[k])));
  if ("radius" in s) set("radius", Math.min(32, out.radius));
  if ("min_seconds" in s) set("min_seconds", Math.min(60, out.min_seconds));
  if ("upload_max_mb" in s) set("upload_max_mb", Math.min(50, Math.max(1, out.upload_max_mb)));
  if ("accent_color" in s) set("accent_color", cleanHexColor(s.accent_color) || d.accent_color);
  if ("text_color" in s) set("text_color", cleanHexColor(s.text_color) || d.text_color);
  if ("font_family" in s) set("font_family", oneOf(s.font_family, ["inter", "inherit", "system"], d.font_family));
  if ("default_theme" in s) set("default_theme", oneOf(s.default_theme, ["light", "dark"], d.default_theme));
  if ("default_mode" in s) set("default_mode", oneOf(s.default_mode, ["classic", "conversational"], d.default_mode));
  if ("ip_mode" in s) set("ip_mode", oneOf(s.ip_mode, ["full", "anonymized", "none"], d.ip_mode));
  if ("csv_delimiter" in s) set("csv_delimiter", oneOf(s.csv_delimiter, [",", ";", "tab"], d.csv_delimiter));
  for (const k of ["label_submit", "label_next", "label_prev", "label_required", "email_from_name"] as const) {
    if (k in s) set(k, cleanText(s[k], 200));
  }
  for (const k of ["thankyou_message", "closed_message"] as const) if (k in s) set(k, cleanMultiline(s[k]));
  if ("email_from" in s) set("email_from", cleanEmailList(s.email_from).split(",")[0]?.trim() ?? "");
  if ("email_admin" in s) set("email_admin", cleanEmailList(s.email_admin));
  if ("upload_types" in s) {
    set(
      "upload_types",
      String(s.upload_types ?? "")
        .toLowerCase()
        .split(",")
        .map((x) => cleanKey(x))
        .filter(Boolean)
        .join(","),
    );
  }
  if ("timezone" in s) {
    const tz = cleanText(s.timezone, 80);
    set("timezone", isValidTimeZone(tz) ? tz : d.timezone);
  }
  return out;
}

/** Extensions that can never be uploaded, whatever the settings say. */
export const BLOCKED_UPLOAD_EXTENSIONS = ["php", "phtml", "phar", "js", "mjs", "html", "htm", "svg", "exe", "sh", "bat", "cmd", "com", "jar"];
