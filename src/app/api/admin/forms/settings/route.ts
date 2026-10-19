import { guarded, json } from "@/modules/auth/guard";
import { getGlobalSettings, saveGlobalSettings } from "@/modules/forms/lib/settings-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return guarded(request, "forms.settings", async () => json({ settings: await getGlobalSettings() }, 200));
}

export async function PUT(request: Request) {
  return guarded(request, "forms.settings", async () => {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid request." }, 400);
    return json({ settings: await saveGlobalSettings(body) }, 200);
  });
}
