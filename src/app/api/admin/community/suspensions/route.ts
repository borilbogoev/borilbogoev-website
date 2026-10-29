import { api, ok, readBody } from "@/modules/community/server/api";
import { invalid, isUuid, toId } from "@/modules/community/server/core";
import { canManageGlobal } from "@/modules/community/server/permissions";
import { log } from "@/modules/community/server/admin";
import { liftSuspension, suspendUser } from "@/modules/community/server/safety";
import { unwrap } from "@/modules/community/server/posts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return api(request, async (viewer) => {
    unwrap(canManageGlobal(viewer.actor));
    const b = await readBody(request);
    if (!isUuid(b.userId)) throw invalid();
    if (b.userId === viewer.user.id) throw invalid("You can't suspend yourself.");
    const id = await suspendUser(viewer.user.id, b.userId, typeof b.reason === "string" ? b.reason : "");
    await log(viewer.user.id, "suspension.add", "user", b.userId, { reason: b.reason ?? "" });
    return ok({ id }, 201);
  }, { membership: false });
}

export async function DELETE(request: Request) {
  return api(request, async (viewer) => {
    unwrap(canManageGlobal(viewer.actor));
    const id = toId(new URL(request.url).searchParams.get("id"));
    if (!id) throw invalid();
    await liftSuspension(id);
    await log(viewer.user.id, "suspension.lift", "suspension", id);
    return ok({ ok: true });
  }, { membership: false });
}
