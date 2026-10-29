import { api, ok, readBody } from "@/modules/community/server/api";
import { listConversations, openConversation } from "@/modules/community/server/chat";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return api(request, async (viewer) => ok(await listConversations(viewer)), { membership: false });
}

// Get or create the direct conversation with a person.
export async function POST(request: Request) {
  return api(request, async (viewer) => {
    const b = await readBody(request);
    return ok({ id: await openConversation(viewer, String(b.userId ?? "")) });
  }, { membership: false });
}
