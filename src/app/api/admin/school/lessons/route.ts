import { guarded, json } from "@/modules/auth/guard";
import { createLesson } from "@/modules/school/lib/courses";
import { refreshSchool } from "@/modules/school/lib/revalidate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return guarded(request, "school.write", async (user) => {
    const body = (await request.json().catch(() => ({}))) as { moduleId?: number; title?: string };
    const id = await createLesson(Number(body.moduleId), String(body.title ?? ""), user.id);
    if (!id) return json({ error: "Module not found." }, 404);
    await refreshSchool();
    return json({ id }, 201);
  });
}
