import { guarded, json } from "@/modules/auth/guard";
import { searchUsers } from "@/modules/school/lib/access";

export const runtime = "nodejs";

// Registered users to pick from when enrolling people in a course: ?q=<name or email>&course=<id>
export async function GET(request: Request) {
  return guarded(request, "school.enrol", async () => {
    const p = new URL(request.url).searchParams;
    return json({ users: await searchUsers(p.get("q") ?? "", Number(p.get("course")) || undefined) }, 200);
  });
}
