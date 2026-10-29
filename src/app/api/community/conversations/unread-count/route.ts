import { api, ok } from "@/modules/community/server/api";
import { unreadConversations } from "@/modules/community/server/chat";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return api(request, async (viewer) => ok({ count: await unreadConversations(viewer) }), { membership: false });
}
