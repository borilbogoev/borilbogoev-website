import { guarded, json } from "@/modules/auth/guard";
import { createDeck, listDecks } from "@/modules/presentations/lib/presentations";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return guarded(request, "presentations.view", async () => {
    const p = new URL(request.url).searchParams;
    const decks = await listDecks({ q: p.get("q") ?? "", status: p.get("status") ?? "", category: Number(p.get("category")) || undefined, tag: p.get("tag") ?? "" });
    return json({ presentations: decks.map((d) => ({ ...d, publishedAt: d.publishedAt?.toISOString() ?? null, createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString() })) }, 200);
  });
}

export async function POST(request: Request) {
  return guarded(request, "presentations.write", async (user) => {
    const body = (await request.json().catch(() => ({}))) as { title?: string; slug?: string; template?: string; mode?: string; orientation?: string; categoryId?: number | null };
    const id = await createDeck({ title: String(body.title ?? ""), slug: body.slug ? String(body.slug) : undefined, template: String(body.template ?? "blank"), mode: body.mode, orientation: body.orientation, categoryId: body.categoryId ? Number(body.categoryId) : null }, user.id);
    return json({ id }, 201);
  });
}
