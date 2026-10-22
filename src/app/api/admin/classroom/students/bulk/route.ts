import { guarded, json } from "@/modules/auth/guard";
import { adminEnrolMany } from "@/modules/classroom/lib/access";
import { getCourse } from "@/modules/classroom/lib/courses";

export const runtime = "nodejs";

// Enrols several registered users in one course: { userIds: [...], courseId, paid?, note? }
export async function POST(request: Request) {
  return guarded(request, "classroom.enrol", async () => {
    const body = (await request.json().catch(() => ({}))) as { userIds?: unknown; courseId?: number; paid?: boolean; note?: string };
    const course = await getCourse(Number(body.courseId));
    if (!course) return json({ error: "Choose a course." }, 400);
    const ids = Array.isArray(body.userIds) ? body.userIds.map(String) : [];
    if (!ids.length) return json({ error: "Select at least one user." }, 400);
    return json(await adminEnrolMany(ids, course, { paid: !!body.paid, note: typeof body.note === "string" ? body.note : undefined }), 201);
  });
}
