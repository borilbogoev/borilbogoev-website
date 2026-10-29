import { api, ok } from "@/modules/community/server/api";
import { listNotifications } from "@/modules/community/server/notifications";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return api(request, async (viewer) => ok(await listNotifications(viewer.user.id, new URL(request.url).searchParams.get("cursor"))), { membership: false });
}
