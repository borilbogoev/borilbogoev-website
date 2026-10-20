import { guarded, json } from "@/modules/auth/guard";
import { dashboard } from "@/modules/presentations/lib/stats";

export const runtime = "nodejs";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return guarded(request, "presentations.view", async () => {
    const p = new URL(request.url).searchParams;
    const data = await dashboard(Number((await ctx.params).id), p.get("from") ?? undefined, p.get("to") ?? undefined, p.get("interval") ?? undefined);
    return data ? json(data, 200) : json({ error: "Presentation not found." }, 404);
  });
}
