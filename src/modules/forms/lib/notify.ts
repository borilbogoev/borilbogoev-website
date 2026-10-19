// Email notifications, autoresponder and webhooks. Ported from class-bbf-notify.php.
// Email goes out through Resend (the same account the inquiry form uses).
import { createHmac } from "node:crypto";
import { site } from "@/content/site";
import { fieldsOf, isEmailField, type Block, type Field } from "./blocks";
import type { Form } from "./forms";
import { escapeHtml, renderMarkdown } from "./markdown";
import { isEmail } from "./sanitize";
import type { GlobalSettings } from "./settings";
import type { AnswerValue, ResponseRecord, Values } from "./responses";

const asText = (v: AnswerValue | undefined) => (Array.isArray(v) ? v.join(", ") : String(v ?? ""));

type Mail = { to: string[]; subject: string; html: string; replyTo?: string };

export async function sendMail(mail: Mail, g: GlobalSettings): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[forms] RESEND_API_KEY is not set, email skipped.");
    return false;
  }
  const fromEmail = g.email_from || process.env.INQUIRY_FROM_EMAIL;
  const from = g.email_from ? `${g.email_from_name || site.name} <${g.email_from}>` : (fromEmail ?? "Website <onboarding@resend.dev>");
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: mail.to, subject: mail.subject, html: mail.html, ...(mail.replyTo ? { reply_to: mail.replyTo } : {}) }),
    });
    if (!res.ok) console.error("[forms] email failed with status", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (error) {
    console.error("[forms] email failed", error instanceof Error ? error.message : error);
    return false;
  }
}

function formatDate(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

type Ctx = { form: Form; response: ResponseRecord; values: Values; fields: Field[]; timeZone: string };

function tagMap({ form, response, values, timeZone }: Ctx): Record<string, string> {
  const map: Record<string, string> = {
    form_title: form.title,
    form_id: String(form.id),
    response_id: String(response.id),
    response_seq: String(response.seq),
    date: formatDate(response.created_at, timeZone),
    site_name: site.name,
  };
  for (const [k, v] of Object.entries(values)) map[k] = asText(v);
  return map;
}

/** Plain text (subjects): tags replaced, unknown tags removed, HTML stripped. */
export function plainTags(text: string, ctx: Ctx): string {
  const map = tagMap(ctx);
  return text
    .replace(/\{([a-z0-9_]+)\}/g, (_m, k: string) => map[k] ?? "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

/** HTML body: Markdown rendered with the answers inserted afterwards, escaped, so an answer can never inject markup or links. */
export function htmlTags(text: string, ctx: Ctx): string {
  const map = tagMap(ctx);
  const slots: string[] = [];
  const slot = (value: string) => {
    slots.push(escapeHtml(value).replace(/\n/g, "<br>"));
    return `\u0002${slots.length - 1}\u0002`;
  };
  const withSlots = text.replace("{all_fields}", "\n\n\u0003\n\n").replace(/\{([a-z0-9_]+)\}/g, (_m, k: string) => (k in map ? slot(map[k]) : ""));
  let out = renderMarkdown(withSlots);

  const rows = ctx.fields
    .filter((f) => f.key in ctx.values && asText(ctx.values[f.key]) !== "")
    .map((f) => {
      const v = asText(ctx.values[f.key]);
      const cell =
        f.type === "file" && v.startsWith("/") ? `<a href="${escapeHtml(site.url + v)}">${escapeHtml(v.split("/").pop() ?? "file")}</a>` : escapeHtml(v).replace(/\n/g, "<br>");
      return `<tr><td style="padding:12px 0;border-bottom:1px solid #eee;vertical-align:top;width:38%;color:#6b6b6b;font-size:13px">${escapeHtml(f.label)}</td><td style="padding:12px 0;border-bottom:1px solid #eee;color:#111;font-size:14px;font-weight:600">${cell}</td></tr>`;
    })
    .join("");
  const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 16px">${rows}</table>`;
  out = out.replace("<p>\u0003</p>", table).replace("\u0003", table);
  return out.replace(/\u0002(\d+)\u0002/g, (_m, i: string) => slots[Number(i)] ?? "");
}

function wrapEmail(form: Form, g: GlobalSettings, bodyHtml: string, ctaUrl: string): string {
  const accent = form.settings.accent || g.accent_color;
  const cta = ctaUrl
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${escapeHtml(accent)};color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:14px">View response</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f6f6f6;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#111"><div style="max-width:600px;margin:0 auto;padding:32px 16px"><div style="background:#fff;border:1px solid #ececec;border-radius:18px;padding:32px"><div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${escapeHtml(accent)};font-weight:700;margin-bottom:8px">${escapeHtml(form.title)}</div><div style="font-size:15px;line-height:1.6">${bodyHtml}</div>${cta}</div><div style="text-align:center;font-size:12px;color:#9a9a9a;margin-top:16px">${escapeHtml(site.name)}</div></div></body></html>`;
}

export type NotifyInput = { form: Form; blocks: Block[]; response: ResponseRecord; values: Values; settings: GlobalSettings };

/** Admin notification, respondent autoresponder and webhook for a new response. Never throws. */
export async function onResponse({ form, blocks, response, values, settings: g }: NotifyInput): Promise<void> {
  const s = form.settings;
  const fields = fieldsOf(blocks);
  const ctx: Ctx = { form, response, values, fields, timeZone: g.timezone };

  let replyTo = "";
  for (const f of fields) {
    const v = asText(values[f.key]);
    if (isEmailField(f) && v && isEmail(v)) {
      replyTo = v;
      break;
    }
  }

  const jobs: Promise<unknown>[] = [];
  if (s.notify_admin) {
    const to = (s.notify_to || g.email_admin).split(",").map((x) => x.trim()).filter(Boolean);
    if (to.length) {
      const link = `${site.url}/admin/forms/${form.id}/responses?open=${response.id}`;
      jobs.push(sendMail({ to, subject: plainTags(s.notify_subject, ctx), html: wrapEmail(form, g, htmlTags(s.notify_body, ctx), link), replyTo }, g));
    }
  }
  if (s.autoresponder) {
    const to = (s.auto_email_field && asText(values[s.auto_email_field])) || replyTo;
    if (to && isEmail(to)) jobs.push(sendMail({ to: [to], subject: plainTags(s.auto_subject, ctx), html: wrapEmail(form, g, htmlTags(s.auto_body, ctx), "") }, g));
  }
  if (s.webhook_enabled && s.webhook_url) jobs.push(webhook(form, response, values));
  await Promise.allSettled(jobs);
}

async function webhook(form: Form, response: ResponseRecord, values: Values) {
  const payload = {
    event: "response.created",
    form: { id: form.id, title: form.title },
    response: {
      id: response.id,
      seq: response.seq,
      created_at: response.created_at,
      device: response.device,
      channel: response.channel,
      page_url: response.page_url ?? "",
      duration: response.duration,
      meta: response.meta ?? null,
    },
    data: values,
  };
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "Content-Type": "application/json", "User-Agent": "BB-Forms/1.0" };
  if (form.settings.webhook_secret) headers["X-BBForms-Signature"] = `sha256=${createHmac("sha256", form.settings.webhook_secret).update(body).digest("hex")}`;
  try {
    const res = await fetch(form.settings.webhook_url, { method: "POST", headers, body, signal: AbortSignal.timeout(8000), redirect: "manual" });
    if (!res.ok && res.status >= 400) console.error("[forms] webhook returned", res.status);
  } catch (error) {
    console.error("[forms] webhook failed", error instanceof Error ? error.message : error);
  }
}
