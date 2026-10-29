import { api, ok, readBody } from "@/modules/community/server/api";
import { invalid, toId } from "@/modules/community/server/core";
import { setLike } from "@/modules/community/server/likes";

export const runtime = "nodejs";

// { targetType: "post" | "comment", targetId, like: boolean }
export async function POST(request: Request) {
  return api(request, async (viewer) => {
    const b = await readBody(request);
    const id = toId(b.targetId);
    if (!id || (b.targetType !== "post" && b.targetType !== "comment") || typeof b.like !== "boolean") throw invalid();
    return ok(await setLike(viewer, b.targetType, id, b.like));
  }, { membership: false });
}
