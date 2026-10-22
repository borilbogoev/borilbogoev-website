import { guarded, json } from "@/modules/auth/guard";
import { createModule } from "@/modules/classroom/lib/courses";
import { refreshClassroom } from "@/modules/classroom/lib/revalidate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return guarded(request, "classroom.write", async () => {
    const body = (await request.json().catch(() => ({}))) as { courseId?: number; title?: string };
    const courseId = Number(body.courseId);
    if (!courseId) return json({ error: "Choose a course." }, 400);
    const id = await createModule(courseId, String(body.title ?? ""));
    await refreshClassroom();
    return json({ id }, 201);
  });
}
