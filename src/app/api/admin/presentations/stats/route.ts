import { guarded, json } from "@/modules/auth/guard";
import { libraryDashboard } from "@/modules/presentations/lib/stats";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return guarded(request, "presentations.view", async () => json(await libraryDashboard(), 200));
}
