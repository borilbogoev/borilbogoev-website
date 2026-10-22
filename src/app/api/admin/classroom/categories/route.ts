import { guarded, json } from "@/modules/auth/guard";
import { createCategory, listCategories } from "@/modules/classroom/lib/courses";
import { refreshClassroom } from "@/modules/classroom/lib/revalidate";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return guarded(request, "classroom.view", async () => json({ categories: await listCategories() }, 200));
}

export async function POST(request: Request) {
  return guarded(request, "classroom.write", async () => {
    const res = await createCategory(((await request.json().catch(() => ({}))) ?? {}) as { name?: string; summary?: string; image?: unknown });
    if (!res.ok) return json({ error: res.error }, 409);
    await refreshClassroom();
    return json({ id: res.id }, 201);
  });
}
