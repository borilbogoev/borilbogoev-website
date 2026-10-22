import { json } from "@/modules/auth/guard";
import { markLesson } from "@/modules/classroom/lib/learn";
import { lessonContext, learner } from "@/modules/classroom/lib/lesson-api";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

// { done: true | false } marks the lesson; no body just records that the student opened it (to resume there).
export async function POST(request: Request, ctx: Ctx) {
  return learner(request, async (user) => {
    const c = await lessonContext(Number((await ctx.params).id));
    if (!c) return json({ error: "Lesson not found." }, 404);
    if (!c.access.ok) return json({ error: "Not allowed." }, 403);
    const body = (await request.json().catch(() => ({}))) as { done?: unknown };
    await markLesson(user.id, c.lesson.id, c.course.id, typeof body.done === "boolean" ? body.done : undefined);
    return json({ saved: true }, 200);
  });
}
