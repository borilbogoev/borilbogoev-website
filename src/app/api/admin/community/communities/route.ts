import { api, ok, readBody } from "@/modules/community/server/api";
import { createCommunity, reorderCommunities } from "@/modules/community/server/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return api(request, async (viewer) => {
    const b = await readBody(request);
    if (Array.isArray(b.order)) {
      await reorderCommunities(viewer, b.order.filter((x): x is number => Number.isInteger(x)));
      return ok({ ok: true });
    }
    const c = await createCommunity(viewer, b);
    return ok({ id: c.id, slug: c.slug }, 201);
  }, { membership: false });
}
