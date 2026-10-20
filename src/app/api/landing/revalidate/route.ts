import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

// Lets the management script refresh a published page at once after it edits the database directly.
// Send: Authorization: Bearer <LANDING_API_TOKEN> (CRON_SECRET works too) and { "slugs": ["my-page"] }.
export async function POST(request: Request) {
  const token = process.env.LANDING_API_TOKEN || process.env.CRON_SECRET;
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(token ?? "");
  if (!token || a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { slugs?: unknown };
  const slugs = (Array.isArray(body.slugs) ? body.slugs : []).map(String).filter((s) => /^[a-z0-9-]{1,80}$/.test(s)).slice(0, 50);
  for (const slug of slugs) revalidatePath(`/l/${slug}`);
  return Response.json({ revalidated: slugs });
}
