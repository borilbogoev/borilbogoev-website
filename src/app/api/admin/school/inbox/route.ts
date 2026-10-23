import { guarded, json } from "@/modules/auth/guard";
import { inbox, sharedAnswers } from "@/modules/school/lib/learn";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return guarded(request, "school.moderate", async () => {
    const p = new URL(request.url).searchParams;
    const courseId = Number(p.get("course")) || undefined;
    const [questions, answers] = await Promise.all([inbox({ courseId, filter: p.get("filter") ?? "" }), sharedAnswers({ courseId })]);
    return json({ questions, answers }, 200);
  });
}
