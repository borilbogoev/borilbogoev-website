import { guarded, json } from "@/modules/auth/guard";
import { getPage, listRevisions, restoreRevision } from "@/modules/landing/lib/pages";
import { refreshPages } from "@/modules/landing/lib/revalidate";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  return guarded(request, "landing.view", async () => {
    const revisions = await listRevisions(Number((await ctx.params).id));
    return json({ revisions: revisions.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) }, 200);
  });
}

// Puts an earlier version of the content back (the address and the status stay as they are).
export async function POST(request: Request, ctx: Ctx) {
  return guarded(request, "landing.write", async (user) => {
    const id = Number((await ctx.params).id);
    const body = (await request.json().catch(() => ({}))) as { revision?: number };
    const res = await restoreRevision(id, Number(body.revision), user.id);
    if (!res.ok) return json({ error: res.error }, 404);
    refreshPages((await getPage(id))?.slug);
    return json({ restored: true }, 200);
  });
}
