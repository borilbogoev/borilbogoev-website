import { ingest } from "@/modules/presentations/lib/track";

export const runtime = "nodejs";

// Counts a presentation opening and its progress. Called with sendBeacon, so it always answers 204 and never blocks the deck.
export async function POST(request: Request) {
  try {
    await ingest(request);
  } catch (error) {
    console.error("[presentations] tracking failed", error instanceof Error ? error.message : error);
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
