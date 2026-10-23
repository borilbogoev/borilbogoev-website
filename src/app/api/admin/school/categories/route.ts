import { guarded, json } from "@/modules/auth/guard";
import { createCategory, listCategories } from "@/modules/school/lib/courses";
import { refreshSchool } from "@/modules/school/lib/revalidate";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return guarded(request, "school.view", async () => json({ categories: await listCategories() }, 200));
}

export async function POST(request: Request) {
  return guarded(request, "school.write", async () => {
    const res = await createCategory(((await request.json().catch(() => ({}))) ?? {}) as { name?: string; summary?: string; image?: unknown });
    if (!res.ok) return json({ error: res.error }, 409);
    await refreshSchool();
    return json({ id: res.id }, 201);
  });
}
