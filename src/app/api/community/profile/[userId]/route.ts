import { api, ok, type Ctx } from "@/modules/community/server/api";
import { isUuid, notFound, toId } from "@/modules/community/server/core";
import { profileComments, profileMentions, profilePosts } from "@/modules/community/server/profile";

export const runtime = "nodejs";

// ?section=posts|comments|mentions&communityId=&cursor= : filtered by what the caller may see.
export async function GET(request: Request, ctx: Ctx<"userId">) {
  return api(request, async (viewer) => {
    const targetId = (await ctx.params).userId;
    if (!isUuid(targetId)) throw notFound();
    const u = new URL(request.url).searchParams;
    const q = { viewer, targetId, communityId: toId(u.get("communityId")), cursor: u.get("cursor") };
    const section = u.get("section");
    return ok(section === "comments" ? await profileComments(q) : section === "mentions" ? await profileMentions(q) : await profilePosts(q));
  });
}
