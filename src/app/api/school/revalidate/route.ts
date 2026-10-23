import { timingSafeEqual } from "node:crypto";
import { refreshSchool } from "@/modules/school/lib/revalidate";

export const runtime = "nodejs";

// Lets the management script (npm run school) refresh the cached public pages at once after it edits the database directly.
// Send: Authorization: Bearer <SCHOOL_API_TOKEN> (LANDING_API_TOKEN or CRON_SECRET work too).
export async function POST(request: Request) {
  const token = process.env.SCHOOL_API_TOKEN || process.env.CLASSROOM_API_TOKEN || process.env.LANDING_API_TOKEN || process.env.CRON_SECRET;
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(token ?? "");
  if (!token || a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  await refreshSchool();
  return Response.json({ revalidated: true });
}
