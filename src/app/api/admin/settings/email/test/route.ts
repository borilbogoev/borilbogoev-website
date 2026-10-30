import { guarded, json } from "@/modules/auth/guard";
import { sendEmail } from "@/modules/email/lib/send";
import { buildTemplate } from "@/modules/email/lib/templates";
import { cleanEmail } from "@/modules/forms/lib/sanitize";

export const runtime = "nodejs";

// Sends one template, filled with sample data, to the address you choose. The answer is Resend's, not a guess.
export async function POST(request: Request) {
  return guarded(request, "settings.manage", async () => {
    const b = (await request.json().catch(() => ({}))) as { template?: string; to?: string };
    const to = cleanEmail(b.to);
    if (!to) return json({ error: "Enter a valid email address." }, 400);
    const built = await buildTemplate(String(b.template ?? ""));
    if (!built) return json({ error: "Choose a template." }, 400);
    const sent = await sendEmail({ to: [to], template: `test:${built.template}`, subject: `[Test] ${built.subject}`, html: built.html });
    return sent.ok ? json({ sent: true, id: sent.id }, 200) : json({ error: sent.error }, 502);
  });
}
