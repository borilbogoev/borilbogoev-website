import { api, ok, readBody } from "@/modules/community/server/api";
import { createReport } from "@/modules/community/server/safety";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return api(request, async (viewer) => {
    const b = await readBody(request);
    await createReport(viewer, { targetType: b.targetType, targetId: b.targetId, reason: b.reason, details: b.details });
    return ok({ ok: true }, 201);
  }, { membership: false });
}
