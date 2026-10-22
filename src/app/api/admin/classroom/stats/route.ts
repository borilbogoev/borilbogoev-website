import { guarded, json } from "@/modules/auth/guard";
import { libraryStats } from "@/modules/classroom/lib/stats";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return guarded(request, "classroom.view", async () => json(await libraryStats(new URL(request.url).searchParams.get("days")), 200));
}
