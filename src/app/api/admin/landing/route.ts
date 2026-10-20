import { guarded, json } from "@/modules/auth/guard";
import { createPage, listPages } from "@/modules/landing/lib/pages";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return guarded(request, "landing.view", async () => json({ pages: await listPages(new URL(request.url).searchParams.get("q") ?? "") }, 200));
}

export async function POST(request: Request) {
  return guarded(request, "landing.write", async (user) => {
    const body = (await request.json().catch(() => ({}))) as { title?: string; slug?: string; template?: string };
    const id = await createPage({ title: String(body.title ?? ""), slug: body.slug ? String(body.slug) : undefined, template: String(body.template ?? "blank") }, user.id);
    return json({ id }, 201);
  });
}
