import { guarded, json } from "@/modules/auth/guard";
import { duplicatePage } from "@/modules/landing/lib/pages";

export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return guarded(request, "landing.write", async (user) => {
    const id = await duplicatePage(Number((await ctx.params).id), user.id);
    return id ? json({ id }, 201) : json({ error: "Page not found." }, 404);
  });
}
