import { api, ok } from "@/modules/community/server/api";
import { searchUsers } from "@/modules/community/server/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return api(request, async (viewer) => ok({ items: await searchUsers(viewer, new URL(request.url).searchParams.get("q") ?? "") }), { membership: false });
}
