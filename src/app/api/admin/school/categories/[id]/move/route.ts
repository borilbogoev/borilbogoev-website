import { guarded, json } from "@/modules/auth/guard";
import { moveCategory } from "@/modules/school/lib/courses";
import { refreshSchool } from "@/modules/school/lib/revalidate";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  return guarded(request, "school.write", async () => {
    const body = (await request.json().catch(() => ({}))) as { dir?: number };
    await moveCategory(Number((await ctx.params).id), body.dir === -1 ? -1 : 1);
    await refreshSchool();
    return json({ saved: true }, 200);
  });
}
