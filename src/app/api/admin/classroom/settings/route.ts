import { guarded, json } from "@/modules/auth/guard";
import { sanitizeSettings } from "@/modules/classroom/lib/settings";
import { getSettings, hasBunnyKey, saveSecret, saveSettings } from "@/modules/classroom/lib/settings-store";

export const runtime = "nodejs";

async function payload() {
  return { settings: await getSettings(), bunnyKeySaved: await hasBunnyKey() };
}

export async function GET(request: Request) {
  return guarded(request, "classroom.settings", async () => json(await payload(), 200));
}

// bunny_token_key is write-only: send a value to replace it, an empty string to remove it, leave it out to keep it.
export async function PUT(request: Request) {
  return guarded(request, "classroom.settings", async () => {
    const body = (await request.json().catch(() => null)) as (Record<string, unknown> & { bunny_token_key?: string }) | null;
    if (!body) return json({ error: "Invalid request." }, 400);
    await saveSettings(sanitizeSettings(body, await getSettings()));
    if (typeof body.bunny_token_key === "string") await saveSecret("bunny_token_key", body.bunny_token_key.slice(0, 200));
    return json(await payload(), 200);
  });
}
