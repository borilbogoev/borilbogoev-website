import { api, ok } from "@/modules/community/server/api";
import { toId } from "@/modules/community/server/core";
import { scopeById } from "@/modules/community/server/context";
import { suggest } from "@/modules/community/server/communities";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return api(
    request,
    async (viewer) => {
      const url = new URL(request.url);
      const communityId = toId(url.searchParams.get("communityId"));
      const scope = communityId ? await scopeById(viewer, communityId) : undefined;
      return ok({ items: await suggest(viewer, { q: (url.searchParams.get("q") ?? "").slice(0, 60), scope }) });
    },
    { membership: false },
  );
}
