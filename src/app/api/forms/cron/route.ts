import { applyRetention } from "@/modules/forms/lib/responses";
import { getGlobalSettings } from "@/modules/forms/lib/settings-store";

export const runtime = "nodejs";

// Daily maintenance (see vercel.json): deletes responses older than the retention period in Forms > Settings.
// Vercel Cron calls this with "Authorization: Bearer $CRON_SECRET".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const g = await getGlobalSettings();
  const deleted = await applyRetention(g.retention_days);
  return Response.json({ ok: true, deleted });
}
