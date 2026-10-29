import { api, ok, readBody } from "@/modules/community/server/api";
import { blockUser } from "@/modules/community/server/safety";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return api(request, async (viewer) => {
    await blockUser(viewer, String((await readBody(request)).userId ?? ""));
    return ok({ ok: true }, 201);
  }, { membership: false });
}
