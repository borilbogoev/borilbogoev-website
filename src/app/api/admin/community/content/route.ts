import { api, ok, readBody } from "@/modules/community/server/api";
import { invalid, toId } from "@/modules/community/server/core";
import { moderateContent, searchContent } from "@/modules/community/server/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return api(request, async (viewer) => {
    const u = new URL(request.url).searchParams;
    const communityId = toId(u.get("communityId"));
    if (!communityId) throw invalid();
    return ok({ items: await searchContent(viewer, communityId, u.get("q") ?? "") });
  }, { membership: false });
}

export async function POST(request: Request) {
  return api(request, async (viewer) => {
    const b = await readBody(request);
    const id = toId(b.id);
    const kind = b.kind === "post" || b.kind === "comment" ? b.kind : null;
    const status = b.status === "hidden_by_mod" || b.status === "deleted" || b.status === "published" ? b.status : null;
    if (!id || !kind || !status) throw invalid();
    await moderateContent(viewer, kind, id, status);
    return ok({ ok: true });
  }, { membership: false });
}
