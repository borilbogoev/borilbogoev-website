import { z } from "zod";
import { getDb, schema } from "@/db";

export const runtime = "nodejs";

const Body = z.object({
  topic: z.string().trim().min(1).max(40),
  plan: z.string().trim().max(60).optional(),
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  email: z.email("Please enter a valid email address.").max(200),
  company: z.string().trim().max(160).optional(),
  message: z.string().trim().min(10, "Please write at least a sentence.").max(4000),
  page: z.string().max(200).optional(),
  website: z.string().max(200).optional(), // honeypot
  elapsed: z.number().optional(), // ms between page load and submit
});

const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return json({ ok: false, fieldErrors, error: "Please check the highlighted fields." }, 422);
  }
  const data = parsed.data;

  // Bots: a filled honeypot or an instant submit. Pretend it worked so they do not retry.
  if (data.website || (data.elapsed !== undefined && data.elapsed < 1500)) return json({ ok: true });

  const db = getDb();
  const resendKey = process.env.RESEND_API_KEY;
  const to = process.env.INQUIRY_TO_EMAIL;
  const emailReady = Boolean(resendKey && to);

  if (!db && !emailReady) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[inquiry] no database or email configured, logging only:", { topic: data.topic, plan: data.plan, name: data.name });
      return json({ ok: true });
    }
    return json({ ok: false, error: "The form is not available right now. Please reach out on LinkedIn." }, 503);
  }

  let saved = false;
  if (db) {
    try {
      await db.insert(schema.inquiries).values({
        topic: data.topic,
        plan: data.plan || null,
        name: data.name,
        email: data.email,
        company: data.company || null,
        message: data.message,
        page: data.page ?? null,
        userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      });
      saved = true;
    } catch (error) {
      console.error("[inquiry] database insert failed", error instanceof Error ? error.message : error);
    }
  }

  let emailed = false;
  if (emailReady) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.INQUIRY_FROM_EMAIL ?? "Website <onboarding@resend.dev>",
          to: [to],
          reply_to: data.email,
          subject: `New inquiry: ${data.topic}${data.plan ? ` / ${data.plan}` : ""} from ${data.name}`,
          text: [
            `Topic: ${data.topic}`,
            `Plan: ${data.plan || "not chosen"}`,
            `Name: ${data.name}`,
            `Email: ${data.email}`,
            `Company: ${data.company || "-"}`,
            `Page: ${data.page || "-"}`,
            "",
            data.message,
          ].join("\n"),
        }),
      });
      emailed = res.ok;
      if (!res.ok) console.error("[inquiry] email failed with status", res.status);
    } catch (error) {
      console.error("[inquiry] email failed", error instanceof Error ? error.message : error);
    }
  }

  // Success when at least one channel kept the message.
  if (saved || emailed) return json({ ok: true });
  return json({ ok: false, error: "Something went wrong on my side. Please try again, or reach out on LinkedIn." }, 502);
}
