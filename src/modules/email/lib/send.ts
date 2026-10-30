// The one function that sends email. Every transactional message in the system goes through it.
// It talks to Resend, tells the caller the truth (sent or not, and why) and keeps a short log for the admin screen.
import { site } from "@/content/site";
import { appendEmailLog, getEmailConfig } from "./config";

export type SendInput = {
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
  /** Template id, shown in the send log. */
  template: string;
};
export type SendResult = { ok: true; id: string } | { ok: false; error: string };

const htmlToText = (html: string) =>
  html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<\/(p|div|tr|h\d|li)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export async function sendEmail(input: SendInput): Promise<SendResult> {
  const result = await deliver(input);
  const detail = result.ok ? result.id : result.error;
  if (!result.ok) console.error(`[email] ${input.template} to ${input.to.length} recipient(s) failed: ${result.error}`);
  await appendEmailLog({ at: new Date().toISOString(), template: input.template, to: input.to.join(", ").slice(0, 200), ok: result.ok, detail: detail.slice(0, 300) });
  return result;
}

async function deliver(input: SendInput): Promise<SendResult> {
  const c = await getEmailConfig();
  if (!c.apiKey) return { ok: false, error: "No Resend API key. Add one in Admin > Settings > Email." };
  if (c.keyState === "unreadable") return { ok: false, error: "The saved Resend key cannot be read. Enter it again in Admin > Settings > Email." };
  if (!input.to.length) return { ok: false, error: "No recipient." };

  // Without a verified sender address Resend only accepts its sandbox sender, which delivers to the Resend account owner only.
  const fromAddress = c.fromEmail || "onboarding@resend.dev";
  const from = `${c.fromName || site.name} <${fromAddress}>`;
  const replyTo = input.replyTo || c.replyTo;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html, text: htmlToText(input.html), ...(replyTo ? { reply_to: replyTo } : {}) }),
      signal: AbortSignal.timeout(15000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (res.ok && body.id) return { ok: true, id: body.id };
    return { ok: false, error: `Resend answered ${res.status}${body.message ? `: ${body.message}` : ""}` };
  } catch (error) {
    return { ok: false, error: `Could not reach Resend: ${error instanceof Error ? error.message : "unknown error"}` };
  }
}
