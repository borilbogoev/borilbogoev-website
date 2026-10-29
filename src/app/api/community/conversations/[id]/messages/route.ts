import { api, ok, readBody, type Ctx } from "@/modules/community/server/api";
import { listMessages, sendMessage } from "@/modules/community/server/chat";
import { notFound, toId } from "@/modules/community/server/core";

export const runtime = "nodejs";

export async function GET(request: Request, ctx: Ctx<"id">) {
  return api(request, async (viewer) => {
    const id = toId((await ctx.params).id);
    if (!id) throw notFound();
    const url = new URL(request.url);
    return ok(await listMessages(viewer, id, { cursor: url.searchParams.get("cursor"), after: url.searchParams.get("after") }));
  }, { membership: false });
}

export async function POST(request: Request, ctx: Ctx<"id">) {
  return api(request, async (viewer) => {
    const id = toId((await ctx.params).id);
    if (!id) throw notFound();
    const b = await readBody(request);
    const res = await sendMessage(viewer, id, { body: b.body, requestId: typeof b.requestId === "string" ? b.requestId : null });
    return ok(res, res.duplicate ? 200 : 201);
  }, { membership: false });
}
