import { guarded, json } from "@/modules/auth/guard";
import { libraryStats } from "@/modules/school/lib/stats";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return guarded(request, "school.view", async () => json(await libraryStats(new URL(request.url).searchParams.get("days")), 200));
}
