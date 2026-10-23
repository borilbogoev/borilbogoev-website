import { guarded, json } from "@/modules/auth/guard";
import { createModule } from "@/modules/school/lib/courses";
import { refreshSchool } from "@/modules/school/lib/revalidate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return guarded(request, "school.write", async () => {
    const body = (await request.json().catch(() => ({}))) as { courseId?: number; title?: string };
    const courseId = Number(body.courseId);
    if (!courseId) return json({ error: "Choose a course." }, 400);
    const id = await createModule(courseId, String(body.title ?? ""));
    await refreshSchool();
    return json({ id }, 201);
  });
}
