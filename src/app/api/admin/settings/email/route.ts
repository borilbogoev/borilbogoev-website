import { guarded, json } from "@/modules/auth/guard";
import { EmailConfigError, saveEmailConfig } from "@/modules/email/lib/config";
import { emailView } from "@/modules/email/lib/view";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  return guarded(request, "settings.manage", async () => {
    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    try {
      await saveEmailConfig({ apiKey: typeof b.apiKey === "string" ? b.apiKey : undefined, fromEmail: str(b.fromEmail), fromName: str(b.fromName), replyTo: str(b.replyTo), adminTo: str(b.adminTo) });
    } catch (error) {
      if (error instanceof EmailConfigError) return json({ error: error.message }, 400);
      throw error;
    }
    return json(await emailView(), 200);
  });
}
