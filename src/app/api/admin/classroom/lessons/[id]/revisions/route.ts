import { guarded, json } from "@/modules/auth/guard";
import { listRevisions, restoreRevision } from "@/modules/classroom/lib/courses";
import { refreshClassroom } from "@/modules/classroom/lib/revalidate";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  return guarded(request, "classroom.view", async () => json({ revisions: await listRevisions(Number((await ctx.params).id)) }, 200));
}

export async function POST(request: Request, ctx: Ctx) {
  return guarded(request, "classroom.write", async (user) => {
    const body = (await request.json().catch(() => ({}))) as { revisionId?: number };
    const res = await restoreRevision(Number((await ctx.params).id), Number(body.revisionId), user.id);
    if (!res.ok) return json({ error: res.error }, 409);
    await refreshClassroom();
    return json({ restored: true }, 200);
  });
}
