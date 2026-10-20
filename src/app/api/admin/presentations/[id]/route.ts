import { guarded, json } from "@/modules/auth/guard";
import { brandIssues } from "@/modules/presentations/lib/brand";
import { deleteDeck, getDeck, getTree, publicDeck, saveDeck, tagsOf, type SaveInput } from "@/modules/presentations/lib/presentations";
import { refreshDecks } from "@/modules/presentations/lib/revalidate";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

async function payload(id: number) {
  const deck = await getDeck(id);
  if (!deck) return null;
  const [slides, tags] = await Promise.all([getTree(id), tagsOf(id)]);
  return { deck: { ...publicDeck(deck), tags }, slides, issues: brandIssues(slides) };
}

export async function GET(request: Request, ctx: Ctx) {
  return guarded(request, "presentations.view", async () => {
    const data = await payload(Number((await ctx.params).id));
    return data ? json(data, 200) : json({ error: "Presentation not found." }, 404);
  });
}

export async function PUT(request: Request, ctx: Ctx) {
  return guarded(request, "presentations.write", async (user) => {
    const id = Number((await ctx.params).id);
    const before = await getDeck(id);
    if (!before) return json({ error: "Presentation not found." }, 404);
    const body = (await request.json().catch(() => null)) as (SaveInput & { clearPassword?: boolean }) | null;
    if (!body) return json({ error: "Invalid request." }, 400);
    const input: SaveInput = { ...body };
    if (body.clearPassword) input.password = null;
    const res = await saveDeck(id, input, user.id);
    if (!res.ok) return json({ error: res.error }, 409);
    refreshDecks(before.slug, res.deck.slug);
    return json((await payload(id)) ?? {}, 200);
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return guarded(request, "presentations.delete", async () => {
    const id = Number((await ctx.params).id);
    const deck = await getDeck(id);
    await deleteDeck(id);
    refreshDecks(deck?.slug);
    return json({ deleted: true }, 200);
  });
}
