import { trackEvent } from "@/modules/forms/lib/service";

export const runtime = "nodejs";

// Counts a view or the first interaction. Aggregated per day, no personal data.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const data = await request.formData();
    await trackEvent(Number(id), String(data.get("type") ?? ""));
  } catch {
    // Tracking must never break the form.
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
