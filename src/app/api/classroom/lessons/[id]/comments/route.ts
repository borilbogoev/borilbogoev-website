import { json } from "@/modules/auth/guard";
import { addComment, listComments } from "@/modules/classroom/lib/learn";
import { isModerator, lessonContext, learner } from "@/modules/classroom/lib/lesson-api";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  return learner(request, async (user) => {
    const c = await lessonContext(Number((await ctx.params).id));
    if (!c?.access.ok || c.access.reason === "preview") return json({ error: "Not allowed." }, 403);
    return json({ comments: await listComments(c.lesson.id, { id: user.id, moderator: isModerator(user) }) }, 200);
  });
}

export async function POST(request: Request, ctx: Ctx) {
  return learner(request, async (user) => {
    const c = await lessonContext(Number((await ctx.params).id));
    if (!c?.access.ok || c.access.reason === "preview") return json({ error: "Enrol in the course to join the discussion." }, 403);
    if (!c.course.settings.comments) return json({ error: "Questions are switched off for this course." }, 403);
    const body = (await request.json().catch(() => ({}))) as { body?: unknown; visibility?: string; parentId?: number };
    const res = await addComment({ lessonId: c.lesson.id, courseId: c.course.id, userId: user.id, body: body.body, visibility: body.visibility, parentId: body.parentId });
    if (!res.ok) return json({ error: res.error }, res.status);
    return json({ id: res.id, comments: await listComments(c.lesson.id, { id: user.id, moderator: isModerator(user) }) }, 201);
  });
}
