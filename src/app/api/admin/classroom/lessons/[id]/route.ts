import { guarded, json } from "@/modules/auth/guard";
import { brandIssues } from "@/modules/classroom/lib/brand";
import { deleteLesson, getLesson, saveLesson, type LessonSave } from "@/modules/classroom/lib/courses";
import { playerBlocks } from "@/modules/classroom/lib/lesson-api";
import { refreshClassroom } from "@/modules/classroom/lib/revalidate";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  return guarded(request, "classroom.view", async () => {
    const lesson = await getLesson(Number((await ctx.params).id));
    if (!lesson) return json({ error: "Lesson not found." }, 404);
    return json({ lesson: { ...lesson, updatedAt: lesson.updatedAt.toISOString(), blocks: await playerBlocks(lesson) }, issues: brandIssues(lesson) }, 200);
  });
}

export async function PUT(request: Request, ctx: Ctx) {
  return guarded(request, "classroom.write", async (user) => {
    const body = (await request.json().catch(() => null)) as LessonSave | null;
    if (!body) return json({ error: "Invalid request." }, 400);
    const res = await saveLesson(Number((await ctx.params).id), body, user.id);
    if (!res.ok) return json({ error: res.error }, 409);
    await refreshClassroom();
    return json({ lesson: { ...res.lesson, updatedAt: res.lesson.updatedAt.toISOString(), blocks: await playerBlocks(res.lesson) }, issues: brandIssues(res.lesson) }, 200);
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return guarded(request, "classroom.delete", async () => {
    await deleteLesson(Number((await ctx.params).id));
    await refreshClassroom();
    return json({ deleted: true }, 200);
  });
}
