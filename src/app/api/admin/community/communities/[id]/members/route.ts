import { api, ok, readBody, type Ctx } from "@/modules/community/server/api";
import { invalid, isUuid, notFound, toId } from "@/modules/community/server/core";
import { addMember, banMember, listMembers, removeMember, setModerator, unbanMember } from "@/modules/community/server/admin";

export const runtime = "nodejs";

export async function GET(request: Request, ctx: Ctx<"id">) {
  return api(request, async (viewer) => {
    const id = toId((await ctx.params).id);
    if (!id) throw notFound();
    const url = new URL(request.url);
    return ok({ items: await listMembers(viewer, id, { q: url.searchParams.get("q") ?? "", status: url.searchParams.get("status") ?? "" }) });
  }, { membership: false });
}

// { action: add | remove | make_moderator | remove_moderator | ban | unban, userId, reason? }
export async function POST(request: Request, ctx: Ctx<"id">) {
  return api(request, async (viewer) => {
    const id = toId((await ctx.params).id);
    if (!id) throw notFound();
    const b = await readBody(request);
    const userId = b.userId;
    if (!isUuid(userId)) throw invalid();
    const reason = typeof b.reason === "string" ? b.reason : "";
    switch (b.action) {
      case "add": await addMember(viewer, id, userId); break;
      case "remove": await removeMember(viewer, id, userId); break;
      case "make_moderator": await setModerator(viewer, id, userId, true); break;
      case "remove_moderator": await setModerator(viewer, id, userId, false); break;
      case "ban": await banMember(viewer, id, userId, reason); break;
      case "unban": await unbanMember(viewer, id, userId); break;
      default: throw invalid();
    }
    return ok({ ok: true });
  }, { membership: false });
}
