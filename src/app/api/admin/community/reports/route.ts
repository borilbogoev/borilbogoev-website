import { api, ok } from "@/modules/community/server/api";
import { toId } from "@/modules/community/server/core";
import { listReports } from "@/modules/community/server/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return api(request, async (viewer) => {
    const u = new URL(request.url).searchParams;
    return ok({ items: await listReports(viewer, { status: u.get("status") ?? "", type: u.get("type") ?? "", communityId: toId(u.get("communityId")) }) });
  }, { membership: false });
}
