import { guarded, json } from "@/modules/auth/guard";
import { deleteModule, saveModule, type ModuleSave } from "@/modules/classroom/lib/courses";
import { refreshClassroom } from "@/modules/classroom/lib/revalidate";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, ctx: Ctx) {
  return guarded(request, "classroom.write", async () => {
    const res = await saveModule(Number((await ctx.params).id), ((await request.json().catch(() => ({}))) ?? {}) as ModuleSave);
    if (!res.ok) return json({ error: res.error }, 409);
    await refreshClassroom();
    return json({ saved: true }, 200);
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return guarded(request, "classroom.delete", async () => {
    await deleteModule(Number((await ctx.params).id));
    await refreshClassroom();
    return json({ deleted: true }, 200);
  });
}
