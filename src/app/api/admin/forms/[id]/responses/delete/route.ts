import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db/use";
import { guarded, json } from "@/modules/auth/guard";
import { deleteResponses } from "@/modules/forms/lib/responses";

export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return guarded(request, "responses.delete", async () => {
    const formId = Number((await ctx.params).id);
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown[] };
    const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (!ids.length) return json({ deleted: 0 }, 200);
    // Only ids that belong to this form.
    const own = rowsOf<{ id: number }>(await db().execute(sql`SELECT id FROM bbforms_responses WHERE form_id = ${formId} AND id = ANY(${ids}::int[])`));
    return json({ deleted: await deleteResponses(own.map((r) => Number(r.id))) }, 200);
  });
}
