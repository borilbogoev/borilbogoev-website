// Email settings. One place for everything the system needs to send mail through Resend.
// The API key is typed into Admin > Settings > Email and stored encrypted (AES-256-GCM, key derived from AUTH_SECRET) in
// `bbforms_settings`. Sender and recipient reuse the Forms global settings rows, so there is one source of truth.
// Environment variables (RESEND_API_KEY, INQUIRY_FROM_EMAIL, INQUIRY_TO_EMAIL) still work as a fallback when nothing is saved.
import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { db } from "@/db/use";
import { cleanEmail, cleanText, isEmail } from "@/modules/forms/lib/sanitize";
import { getStoredValues } from "@/modules/forms/lib/settings-store";
import { decryptSecret, encryptSecret } from "@/modules/school/lib/secrets";

const { bbformsSettings: table } = schema;

export type KeyState = "database" | "environment" | "unreadable" | "none";

export type EmailConfig = {
  apiKey: string;
  keyState: KeyState;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  /** Who receives admin notices (inquiries, new Forms responses without their own recipient). Comma separated. */
  adminTo: string;
};

const NAMES = ["email_resend_key", "email_from", "email_from_name", "email_reply_to", "email_admin"];

const address = (v: string) => v.match(/<([^>]+)>/)?.[1] ?? v;

export async function getEmailConfig(): Promise<EmailConfig> {
  let stored: Record<string, unknown> = {};
  try {
    stored = await getStoredValues(NAMES);
  } catch {
    // No database (local without DATABASE_URL): the environment is all there is.
  }
  const text = (name: string) => (typeof stored[name] === "string" ? (stored[name] as string).trim() : "");

  let apiKey = "";
  let keyState: KeyState = "none";
  const saved = text("email_resend_key");
  if (saved) {
    try {
      apiKey = decryptSecret(saved);
    } catch {
      apiKey = "";
    }
    keyState = apiKey ? "database" : "unreadable";
  }
  if (!apiKey && process.env.RESEND_API_KEY) {
    apiKey = process.env.RESEND_API_KEY;
    keyState = "environment";
  }

  const envFrom = process.env.INQUIRY_FROM_EMAIL ?? "";
  return {
    apiKey,
    keyState,
    fromEmail: text("email_from") || address(envFrom),
    fromName: text("email_from_name") || (envFrom.includes("<") ? envFrom.split("<")[0].trim() : ""),
    replyTo: text("email_reply_to"),
    adminTo: text("email_admin") || process.env.INQUIRY_TO_EMAIL || "",
  };
}

/** True when a key is available, so a send can be attempted. */
export async function emailReady(): Promise<boolean> {
  return Boolean((await getEmailConfig()).apiKey);
}

/** The key with all but the last four characters hidden, for the admin screen. Never the whole key. */
export function maskKey(key: string): string {
  return key ? `re_${"•".repeat(12)}${key.slice(-4)}` : "";
}

async function put(name: string, value: unknown) {
  await db().insert(table).values({ name, value }).onConflictDoUpdate({ target: table.name, set: { value } });
}

export type EmailInput = {
  /** undefined: keep the saved key. "": remove it. Otherwise the new key. */
  apiKey?: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  adminTo: string;
};

export class EmailConfigError extends Error {}

export async function saveEmailConfig(input: EmailInput): Promise<void> {
  const fromEmail = cleanEmail(input.fromEmail);
  if (input.fromEmail.trim() && !fromEmail) throw new EmailConfigError("From email is not a valid address.");
  const replyTo = cleanEmail(input.replyTo);
  if (input.replyTo.trim() && !replyTo) throw new EmailConfigError("Reply-to is not a valid address.");
  const adminList = input.adminTo.split(",").map((x) => x.trim()).filter(Boolean);
  if (adminList.some((x) => !isEmail(x))) throw new EmailConfigError("Admin recipients must be valid addresses, separated by commas.");

  if (input.apiKey !== undefined) {
    const key = input.apiKey.trim();
    if (key && !/^re_[A-Za-z0-9_\-]{16,}$/.test(key)) throw new EmailConfigError("That does not look like a Resend API key. Keys start with re_.");
    await put("email_resend_key", key ? encryptSecret(key) : "");
  }
  await put("email_from", fromEmail);
  await put("email_from_name", cleanText(input.fromName, 120));
  await put("email_reply_to", replyTo);
  await put("email_admin", adminList.join(", "));
}

/* ------------------------------ send log ---------------------------------- */

export type LogEntry = { at: string; template: string; to: string; ok: boolean; detail: string };
const LOG = "email_log";
const LOG_MAX = 30;

export async function getEmailLog(): Promise<LogEntry[]> {
  try {
    const [r] = await db().select().from(table).where(eq(table.name, LOG)).limit(1);
    return Array.isArray(r?.value) ? (r.value as LogEntry[]) : [];
  } catch {
    return [];
  }
}

/** Best effort: a failure to log never breaks a send. */
export async function appendEmailLog(entry: LogEntry): Promise<void> {
  try {
    const list = await getEmailLog();
    await put(LOG, [entry, ...list].slice(0, LOG_MAX));
  } catch {
    // ignore
  }
}
