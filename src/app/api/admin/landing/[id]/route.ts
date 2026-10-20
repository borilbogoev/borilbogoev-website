import { guarded, json } from "@/modules/auth/guard";
import { brandIssues } from "@/modules/landing/lib/brand";
import { deletePage, getBlocks, getPage, savePage, type BlockInput } from "@/modules/landing/lib/pages";
import { refreshPages } from "@/modules/landing/lib/revalidate";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

async function payload(id: number) {
  const page = await getPage(id);
  if (!page) return null;
  const blocks = await getBlocks(id);
  return { page: { ...page, publishedAt: page.publishedAt?.toISOString() ?? null, createdAt: page.createdAt.toISOString(), updatedAt: page.updatedAt.toISOString() }, blocks, issues: brandIssues(blocks, page.settings) };
}

export async function GET(request: Request, ctx: Ctx) {
  return guarded(request, "landing.view", async () => {
    const data = await payload(Number((await ctx.params).id));
    return data ? json(data, 200) : json({ error: "Page not found." }, 404);
  });
}

export async function PUT(request: Request, ctx: Ctx) {
  return guarded(request, "landing.write", async (user) => {
    const id = Number((await ctx.params).id);
    const before = await getPage(id);
    if (!before) return json({ error: "Page not found." }, 404);
    const body = (await request.json().catch(() => null)) as { title?: string; slug?: string; status?: string; settings?: unknown; blocks?: BlockInput[]; label?: string } | null;
    if (!body) return json({ error: "Invalid request." }, 400);
    const res = await savePage(id, body, user.id);
    if (!res.ok) return json({ error: res.error }, 409);
    refreshPages(before.slug, res.page.slug);
    return json((await payload(id)) ?? {}, 200);
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return guarded(request, "landing.delete", async () => {
    const id = Number((await ctx.params).id);
    const page = await getPage(id);
    await deletePage(id);
    refreshPages(page?.slug);
    return json({ deleted: true }, 200);
  });
}
