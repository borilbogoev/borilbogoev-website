import { guarded, json } from "@/modules/auth/guard";
import { deleteCourse, getTree, publicCourse, saveCourse, type CourseSave } from "@/modules/school/lib/courses";
import { refreshSchool } from "@/modules/school/lib/revalidate";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

async function payload(id: number) {
  const tree = await getTree(id, { drafts: true });
  return tree ? { course: publicCourse(tree.course), modules: tree.modules } : null;
}

export async function GET(request: Request, ctx: Ctx) {
  return guarded(request, "school.view", async () => {
    const data = await payload(Number((await ctx.params).id));
    return data ? json(data, 200) : json({ error: "Course not found." }, 404);
  });
}

export async function PUT(request: Request, ctx: Ctx) {
  return guarded(request, "school.write", async () => {
    const id = Number((await ctx.params).id);
    const body = (await request.json().catch(() => null)) as CourseSave | null;
    if (!body) return json({ error: "Invalid request." }, 400);
    const res = await saveCourse(id, body);
    if (!res.ok) return json({ error: res.error }, 409);
    await refreshSchool();
    return json((await payload(id)) ?? {}, 200);
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return guarded(request, "school.delete", async () => {
    await deleteCourse(Number((await ctx.params).id));
    await refreshSchool();
    return json({ deleted: true }, 200);
  });
}
