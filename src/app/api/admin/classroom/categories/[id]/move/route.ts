import { guarded, json } from "@/modules/auth/guard";
import { moveCategory } from "@/modules/classroom/lib/courses";
import { refreshClassroom } from "@/modules/classroom/lib/revalidate";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  return guarded(request, "classroom.write", async () => {
    const body = (await request.json().catch(() => ({}))) as { dir?: number };
    await moveCategory(Number((await ctx.params).id), body.dir === -1 ? -1 : 1);
    await refreshClassroom();
    return json({ saved: true }, 200);
  });
}
