import { guarded, json } from "@/modules/auth/guard";
import { getDeck, listRevisions, restoreRevision } from "@/modules/presentations/lib/presentations";
import { refreshDecks } from "@/modules/presentations/lib/revalidate";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  return guarded(request, "presentations.view", async () => {
    const revisions = await listRevisions(Number((await ctx.params).id));
    return json({ revisions: revisions.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) }, 200);
  });
}

// Puts an earlier version of the content back (the address, status and password stay as they are).
export async function POST(request: Request, ctx: Ctx) {
  return guarded(request, "presentations.write", async (user) => {
    const id = Number((await ctx.params).id);
    const body = (await request.json().catch(() => ({}))) as { revision?: number };
    const res = await restoreRevision(id, Number(body.revision), user.id);
    if (!res.ok) return json({ error: res.error }, 404);
    refreshDecks((await getDeck(id))?.slug);
    return json({ restored: true }, 200);
  });
}
