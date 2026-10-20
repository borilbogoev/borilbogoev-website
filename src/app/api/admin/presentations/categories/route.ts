import { guarded, json } from "@/modules/auth/guard";
import { createCategory, listCategories, listTags } from "@/modules/presentations/lib/presentations";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return guarded(request, "presentations.view", async () => json({ categories: await listCategories(), tags: await listTags() }, 200));
}

export async function POST(request: Request) {
  return guarded(request, "presentations.write", async () => {
    const body = (await request.json().catch(() => ({}))) as { name?: string };
    const res = await createCategory(String(body.name ?? ""));
    return res.ok ? json({ id: res.id, categories: await listCategories() }, 201) : json({ error: res.error }, 409);
  });
}
