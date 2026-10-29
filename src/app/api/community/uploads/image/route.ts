import { api, ok } from "@/modules/community/server/api";
import { invalid, toId } from "@/modules/community/server/core";
import { scopeById, getDefaultCommunity, scopeFor } from "@/modules/community/server/context";
import { discardImage, saveImage } from "@/modules/community/server/uploads";

export const runtime = "nodejs";
export const maxDuration = 60;

// One image per request. The server checks the type by content, re-encodes it and picks the storage key.
export async function POST(request: Request) {
  return api(request, async (viewer) => {
    const data = await request.formData().catch(() => null);
    const file = data?.get("file");
    if (!(file instanceof File)) throw invalid("Choose an image.");
    const communityId = toId(String(data?.get("communityId") ?? ""));
    const scope = communityId ? await scopeById(viewer, communityId) : await scopeFor(viewer, await getDefaultCommunity());
    return ok({ media: await saveImage(scope, file, String(data?.get("alt") ?? "")) }, 201);
  });
}

export async function DELETE(request: Request) {
  return api(request, async (viewer) => {
    const id = toId(new URL(request.url).searchParams.get("id"));
    if (id) await discardImage(viewer.user.id, id);
    return ok({ ok: true });
  });
}
