import { getForm } from "@/modules/forms/lib/forms";
import { buildPublicForm } from "@/modules/forms/lib/service";

export const runtime = "nodejs";

// What the browser needs to show a form. Always fresh: status, schedule and limits change at any time.
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const form = await getForm(Number(id));
    const pub = form ? await buildPublicForm(form) : null;
    if (!pub) return Response.json({ error: "Form not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    return Response.json(pub, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[forms] definition failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "This form is not available right now." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
