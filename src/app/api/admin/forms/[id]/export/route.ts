import { site } from "@/content/site";
import { guarded, json } from "@/modules/auth/guard";
import { responseQueryFrom } from "@/modules/forms/lib/admin-query";
import { buildCsv, numericKeys } from "@/modules/forms/lib/csv";
import { getBlocks, getForm } from "@/modules/forms/lib/forms";
import { queryResponses } from "@/modules/forms/lib/responses";
import { cleanSlug } from "@/modules/forms/lib/sanitize";
import { getGlobalSettings } from "@/modules/forms/lib/settings-store";
import { todayIn } from "@/modules/forms/lib/stats";

export const runtime = "nodejs";

// CSV of the current view (same filters as the responses table).
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return guarded(request, "responses.export", async () => {
    const id = Number((await ctx.params).id);
    const form = await getForm(id);
    if (!form) return json({ error: "Form not found." }, 404);
    const [blocks, g] = await Promise.all([getBlocks(id), getGlobalSettings()]);
    const res = await queryResponses(id, { ...responseQueryFrom(new URL(request.url)), all: true, numericKeys: numericKeys(blocks), timeZone: g.timezone });
    const csv = buildCsv(blocks, res.items, g.csv_delimiter, g.timezone, site.url);
    const name = `${cleanSlug(form.title) || `form-${id}`}-responses-${todayIn(g.timezone)}.csv`;
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
  });
}
