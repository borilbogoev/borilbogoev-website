import { guarded, json } from "@/modules/auth/guard";
import { createLesson } from "@/modules/classroom/lib/courses";
import { refreshClassroom } from "@/modules/classroom/lib/revalidate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return guarded(request, "classroom.write", async (user) => {
    const body = (await request.json().catch(() => ({}))) as { moduleId?: number; title?: string };
    const id = await createLesson(Number(body.moduleId), String(body.title ?? ""), user.id);
    if (!id) return json({ error: "Module not found." }, 404);
    await refreshClassroom();
    return json({ id }, 201);
  });
}
