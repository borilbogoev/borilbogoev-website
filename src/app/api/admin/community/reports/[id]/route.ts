import { api, ok, readBody, type Ctx } from "@/modules/community/server/api";
import { notFound, toId } from "@/modules/community/server/core";
import { resolveReport } from "@/modules/community/server/admin";
import type { ReportAction } from "@/modules/community/lib/constants";

export const runtime = "nodejs";

export async function POST(request: Request, ctx: Ctx<"id">) {
  return api(request, async (viewer) => {
    const id = toId((await ctx.params).id);
    if (!id) throw notFound();
    const b = await readBody(request);
    await resolveReport(viewer, id, b.action as ReportAction, typeof b.note === "string" ? b.note : "");
    return ok({ ok: true });
  }, { membership: false });
}
