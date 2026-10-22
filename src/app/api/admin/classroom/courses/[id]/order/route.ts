import { guarded, json } from "@/modules/auth/guard";
import { saveOrder } from "@/modules/classroom/lib/courses";
import { refreshClassroom } from "@/modules/classroom/lib/revalidate";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

// { modules: [{ id, lessons: [lessonId...] }] } in the new order. A lesson dropped into another module moves there.
export async function PUT(request: Request, ctx: Ctx) {
  return guarded(request, "classroom.write", async () => {
    const body = (await request.json().catch(() => null)) as { modules?: { id: number; lessons: number[] }[] } | null;
    if (!body?.modules || !Array.isArray(body.modules)) return json({ error: "Invalid request." }, 400);
    await saveOrder(Number((await ctx.params).id), body.modules.map((m) => ({ id: Number(m.id), lessons: (Array.isArray(m.lessons) ? m.lessons : []).map(Number) })));
    await refreshClassroom();
    return json({ saved: true }, 200);
  });
}
