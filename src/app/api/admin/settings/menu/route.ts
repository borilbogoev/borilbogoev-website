import { guarded, json } from "@/modules/auth/guard";
import { getMenuEntries, saveMenuEntries } from "@/modules/settings/lib/menu";
import { refreshMenu } from "@/modules/settings/lib/revalidate";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return guarded(request, "settings.manage", async () => json({ menu: await getMenuEntries() }, 200));
}

export async function PUT(request: Request) {
  return guarded(request, "settings.manage", async () => {
    const body = (await request.json().catch(() => ({}))) as { menu?: unknown };
    let menu;
    try {
      menu = await saveMenuEntries(body.menu);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Invalid menu." }, 400);
    }
    await refreshMenu();
    return json({ menu }, 200);
  });
}
