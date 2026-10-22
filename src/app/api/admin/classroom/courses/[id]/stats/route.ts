import { guarded, json } from "@/modules/auth/guard";
import { courseStats } from "@/modules/classroom/lib/stats";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  return guarded(request, "classroom.view", async () => {
    const data = await courseStats(Number((await ctx.params).id), new URL(request.url).searchParams.get("days"));
    return data ? json(data, 200) : json({ error: "Course not found." }, 404);
  });
}
