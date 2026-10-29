import { api, ok, readBody } from "@/modules/community/server/api";
import { markRead } from "@/modules/community/server/notifications";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return api(request, async (viewer) => {
    const b = await readBody(request);
    const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is number => Number.isInteger(x)) : [];
    await markRead(viewer.user.id, { ids, all: b.all === true });
    return ok({ ok: true });
  }, { membership: false });
}
