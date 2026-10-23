import { guarded, json } from "@/modules/auth/guard";
import { deleteCategory, updateCategory } from "@/modules/school/lib/courses";
import { refreshSchool } from "@/modules/school/lib/revalidate";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, ctx: Ctx) {
  return guarded(request, "school.write", async () => {
    const res = await updateCategory(Number((await ctx.params).id), ((await request.json().catch(() => ({}))) ?? {}) as { name?: string; summary?: string; image?: unknown });
    if (!res.ok) return json({ error: res.error }, 409);
    await refreshSchool();
    return json({ saved: true }, 200);
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return guarded(request, "school.delete", async () => {
    await deleteCategory(Number((await ctx.params).id));
    await refreshSchool();
    return json({ deleted: true }, 200);
  });
}
