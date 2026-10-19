import { guarded, json } from "@/modules/auth/guard";
import { markRead } from "@/modules/forms/lib/responses";

export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ rid: string }> }) {
  return guarded(request, "responses.write", async () => {
    const body = (await request.json().catch(() => ({}))) as { read?: unknown };
    await markRead(Number((await ctx.params).rid), !!body.read);
    return json({ ok: true }, 200);
  });
}
