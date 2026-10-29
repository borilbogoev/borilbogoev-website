import { api, ok } from "@/modules/community/server/api";
import { unreadCount } from "@/modules/community/server/notifications";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return api(request, async (viewer) => ok({ count: await unreadCount(viewer.user.id) }), { membership: false });
}
