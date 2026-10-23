import { guarded, json } from "@/modules/auth/guard";
import { listEnrolments } from "@/modules/school/lib/access";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return guarded(request, "school.view", async () => {
    const p = new URL(request.url).searchParams;
    return json({ enrolments: await listEnrolments({ courseId: Number(p.get("course")) || undefined, status: p.get("status") ?? "", q: p.get("q") ?? "" }) }, 200);
  });
}
