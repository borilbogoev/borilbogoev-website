import { json } from "@/modules/auth/guard";
import { getNote, saveNote } from "@/modules/classroom/lib/learn";
import { lessonContext, learner } from "@/modules/classroom/lib/lesson-api";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  return learner(request, async (user) => {
    const c = await lessonContext(Number((await ctx.params).id));
    if (!c?.access.ok) return json({ error: "Not allowed." }, 403);
    return json(await getNote(user.id, c.lesson.id), 200);
  });
}

// Notes are private: the only reader is the author.
export async function PUT(request: Request, ctx: Ctx) {
  return learner(request, async (user) => {
    const c = await lessonContext(Number((await ctx.params).id));
    if (!c?.access.ok) return json({ error: "Not allowed." }, 403);
    const body = (await request.json().catch(() => ({}))) as { body?: unknown };
    return json({ updatedAt: await saveNote(user.id, c.lesson.id, body.body) }, 200);
  });
}
