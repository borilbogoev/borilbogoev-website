import { api, ok, readBody } from "@/modules/community/server/api";
import { updateSettings } from "@/modules/community/server/admin";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  return api(request, async (viewer) => {
    await updateSettings(viewer, await readBody(request));
    return ok({ ok: true });
  }, { membership: false });
}
