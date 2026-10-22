import { json } from "@/modules/auth/guard";
import { saveBlockState } from "@/modules/classroom/lib/learn";
import { lessonContext, learner } from "@/modules/classroom/lib/lesson-api";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string; blockId: string }> };

// A student's own state in one interactive block (checklist ticks, a written answer, flashcards they know).
export async function PUT(request: Request, ctx: Ctx) {
  return learner(request, async (user) => {
    const { id, blockId } = await ctx.params;
    const c = await lessonContext(Number(id));
    if (!c?.access.ok) return json({ error: "Not allowed." }, 403);
    const data = await saveBlockState(user.id, c.lesson.id, Number(blockId), await request.json().catch(() => ({})));
    return data ? json({ data }, 200) : json({ error: "This block cannot save an answer." }, 400);
  });
}
