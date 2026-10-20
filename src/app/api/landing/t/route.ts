import { ingest } from "@/modules/landing/lib/track";

export const runtime = "nodejs";

// Counts a landing page view or a click. Called with sendBeacon, so it always answers 204 and never blocks the page.
export async function POST(request: Request) {
  try {
    await ingest(request);
  } catch (error) {
    console.error("[landing] tracking failed", error instanceof Error ? error.message : error);
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
