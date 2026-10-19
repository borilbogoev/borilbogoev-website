import { handleSubmit } from "@/modules/forms/lib/service";

export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    return await handleSubmit(request, Number(id));
  } catch (error) {
    console.error("[forms] submit failed", error instanceof Error ? error.message : error);
    return Response.json({ ok: false, message: "Something went wrong. Please try again." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
