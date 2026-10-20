import { guarded, json } from "@/modules/auth/guard";
import { duplicateDeck } from "@/modules/presentations/lib/presentations";

export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return guarded(request, "presentations.write", async (user) => {
    const id = await duplicateDeck(Number((await ctx.params).id), user.id);
    return id ? json({ id }, 201) : json({ error: "Presentation not found." }, 404);
  });
}
