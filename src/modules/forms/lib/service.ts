// Public side of Forms: what a visitor sees and what happens when they submit.
import { after } from "next/server";
import { getCurrentUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import type { Block } from "./blocks";
import { closedReason, getBlocks, getForm, type Form } from "./forms";
import { renderMarkdown } from "./markdown";
import { onResponse } from "./notify";
import type { PublicForm } from "./public-types";
import { getResponse, insertResponse } from "./responses";
import { cleanUrl } from "./sanitize";
import { getGlobalSettings } from "./settings-store";
import type { GlobalSettings } from "./settings";
import { putFile, storageConfigured, fileAnswer } from "./storage";
import { anonymizeIp, channelOf, cleanMeta, clientIp, collect, createToken, deviceOf, hashIp, tokenAge, uploadLimits, type RawAnswers, type RawFiles } from "./submit";
import { db, rowsOf } from "@/db/use";
import { sql } from "drizzle-orm";

const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function closedMessage(form: Form, g: GlobalSettings): string {
  return form.settings.closed_message || g.closed_message;
}

/** The form as a visitor may see it, or null when it does not exist (or is a draft they may not see). */
export async function buildPublicForm(form: Form): Promise<PublicForm | null> {
  const g = await getGlobalSettings();
  const s = form.settings;
  const user = form.status === "draft" || s.require_login ? await getCurrentUser() : null;
  const isStaff = !!user && can(user.role, "forms.view");
  if (form.status === "draft" && !isStaff) return null;

  const mode = s.mode || g.default_mode;
  const base = {
    id: form.id,
    title: form.title,
    draft: form.status === "draft",
    mode: mode === "conversational" ? ("conversational" as const) : ("classic" as const),
    theme: (s.theme || g.default_theme) === "dark" ? ("dark" as const) : ("light" as const),
    accent: s.accent || g.accent_color,
    textColor: g.text_color,
    radius: g.radius,
    fontFamily: g.font_family,
    maxWidth: Math.max(320, s.max_width),
    progress: !!s.progress,
    pageNumbers: !!s.page_numbers,
    oneOnly: !!s.one_per_visitor,
    track: !!g.track_views,
    labels: { submit: s.submit_label || g.label_submit, next: s.next_label || g.label_next, prev: s.prev_label || g.label_prev, required: g.label_required },
    token: createToken(form.id),
  };

  const reason = await closedReason(form);
  if (reason && !(reason === "status" && form.status === "draft" && isStaff)) {
    return { ...base, state: "closed", notice: renderMarkdown(closedMessage(form, g)), blocks: [] };
  }
  if (s.require_login && !user) {
    return { ...base, state: "login", notice: renderMarkdown("Please sign in to fill out this form."), blocks: [] };
  }

  const blocks = (await getBlocks(form.id)).map((b) => withUploadLimits(b, g));
  return { ...base, state: "open", blocks };
}

function withUploadLimits(b: Block, g: GlobalSettings): Block {
  if (b.type !== "file") return b;
  const { maxMb, types } = uploadLimits(b.settings as { types?: string; max_mb?: number }, g);
  return { ...b, settings: { ...b.settings, types: types.join(","), max_mb: maxMb } };
}

export async function trackEvent(formId: number, type: string) {
  const { track } = await import("./stats");
  const g = await getGlobalSettings();
  const form = await getForm(formId);
  if (g.track_views && form && form.status === "active" && (type === "view" || type === "start")) await track(formId, type);
}

/** POST /api/forms/:id/submit */
export async function handleSubmit(request: Request, formId: number): Promise<Response> {
  const form = await getForm(formId);
  if (!form) return json({ ok: false, message: "Form not found." }, 404);
  const g = await getGlobalSettings();
  const s = form.settings;

  let data: FormData;
  try {
    data = await request.formData();
  } catch {
    return json({ ok: false, message: "Invalid request." }, 400);
  }

  const user = form.status === "draft" || s.require_login ? await getCurrentUser() : null;
  const isStaff = !!user && can(user.role, "forms.view");
  const reason = await closedReason(form);
  if (reason && !(reason === "status" && form.status === "draft" && isStaff)) return json({ ok: false, message: closedMessage(form, g) }, 403);
  if (s.require_login && !user) return json({ ok: false, message: "Please sign in to submit this form." }, 403);

  // Spam protection: honeypot, signed timing token, per-IP rate limit.
  if (g.honeypot && String(data.get("_hp") ?? "") !== "") return json({ ok: false, message: "Submission rejected." }, 400);
  const age = tokenAge(formId, String(data.get("_t") ?? ""));
  if (age < 0 || age < g.min_seconds) return json({ ok: false, message: "Submission was too fast. Please try again." }, 400);
  const ip = clientIp(request);
  const ipHash = hashIp(ip);
  if (g.rate_limit > 0) {
    const [r] = rowsOf<{ n: number }>(await db().execute(sql`SELECT COUNT(*)::int AS n FROM bbforms_responses WHERE ip_hash = ${ipHash} AND created_at > now() - interval '1 hour'`));
    if ((r?.n ?? 0) >= g.rate_limit) return json({ ok: false, message: "Too many submissions. Please try again later." }, 429);
  }
  if (s.one_per_visitor && new RegExp(`(?:^|;\\s*)bbf_done_${formId}=1`).test(request.headers.get("cookie") ?? "")) {
    return json({ ok: false, message: "You have already submitted this form." }, 403);
  }

  // Answers and files.
  const raw: RawAnswers = {};
  const files: RawFiles = {};
  for (const [name, value] of data.entries()) {
    if (name.startsWith("a.") && typeof value === "string") (raw[name.slice(2)] ??= []).push(value);
    else if (name.startsWith("f.") && value instanceof File) files[name.slice(2)] = value;
  }
  const blocks = await getBlocks(formId);
  const result = collect(blocks, raw, files, g, true);
  if (Object.keys(result.errors).length) return json({ ok: false, errors: result.errors }, 422);

  // Store files only now that everything else is valid.
  if (Object.keys(result.uploads).length) {
    if (!storageConfigured()) return json({ ok: false, message: "File uploads are not available right now." }, 503);
    try {
      for (const [key, file] of Object.entries(result.uploads)) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80);
        const saved = await putFile(`uploads/${formId}/${safeName}`, file, file.type || "application/octet-stream");
        result.values[key] = fileAnswer(saved.pathname);
      }
    } catch (error) {
      console.error("[forms] upload failed", error instanceof Error ? error.message : error);
      return json({ ok: false, message: "Upload failed. Please try again." }, 502);
    }
  }

  const meta = cleanMeta(String(data.get("_meta") ?? ""));
  const ua = (request.headers.get("user-agent") ?? "").slice(0, 255);
  const storedIp = g.ip_mode === "full" ? ip : g.ip_mode === "anonymized" ? anonymizeIp(ip) : "";
  let created;
  try {
    created = await insertResponse(formId, result.values, {
      origin: "form",
      channel: channelOf(meta).slice(0, 190),
      device: deviceOf(ua),
      ip: storedIp,
      ipHash,
      userAgent: g.store_user_agent ? ua : "",
      referrer: cleanUrl(meta.referrer, false),
      pageUrl: cleanUrl(meta.page_url, false),
      userId: user?.id ?? null,
      duration: Math.min(86400, Math.max(0, Number.parseInt(String(data.get("_elapsed") ?? "0"), 10) || 0)),
      meta,
    });
  } catch (error) {
    console.error("[forms] could not save response", error instanceof Error ? error.message : error);
    return json({ ok: false, message: "Could not save your response. Please try again." }, 500);
  }

  // Emails and webhooks run after the visitor already has their answer.
  after(async () => {
    const response = await getResponse(created.id);
    if (response) await onResponse({ form, blocks, response, values: result.values, settings: g });
  });

  let redirect = "";
  if (s.after_submit === "page" && s.thankyou_page) redirect = s.thankyou_page;
  else if (s.after_submit === "url" && s.redirect_url) redirect = s.redirect_url;
  if (redirect && s.pass_params) {
    const u = new URL(redirect, "https://placeholder.invalid");
    u.searchParams.set("bbf_form", String(formId));
    u.searchParams.set("bbf_response", String(created.seq));
    redirect = redirect.startsWith("/") ? `${u.pathname}${u.search}${u.hash}` : u.toString();
  }
  let thanks = s.thankyou_message || g.thankyou_message;
  for (const [k, v] of Object.entries(result.values)) thanks = thanks.replaceAll(`{${k}}`, Array.isArray(v) ? v.join(", ") : v);
  return json({ ok: true, redirect, message: renderMarkdown(thanks.replace(/\{[a-z0-9_]+\}/g, "")) });
}
