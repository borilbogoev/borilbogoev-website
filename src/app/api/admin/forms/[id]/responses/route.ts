import { guarded, json } from "@/modules/auth/guard";
import { rawFromValues, responseQueryFrom } from "@/modules/forms/lib/admin-query";
import { getBlocks, getForm } from "@/modules/forms/lib/forms";
import { getResponse, insertResponse, queryResponses } from "@/modules/forms/lib/responses";
import { getGlobalSettings } from "@/modules/forms/lib/settings-store";
import { collect } from "@/modules/forms/lib/submit";
import { numericKeys } from "@/modules/forms/lib/csv";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  return guarded(request, "forms.view", async () => {
    const id = Number((await ctx.params).id);
    if (!(await getForm(id))) return json({ error: "Form not found." }, 404);
    const [blocks, g] = await Promise.all([getBlocks(id), getGlobalSettings()]);
    const q = responseQueryFrom(new URL(request.url));
    return json(await queryResponses(id, { ...q, numericKeys: numericKeys(blocks), timeZone: g.timezone }), 200);
  });
}

export async function POST(request: Request, ctx: Ctx) {
  return guarded(request, "responses.write", async (user) => {
    const id = Number((await ctx.params).id);
    if (!(await getForm(id))) return json({ error: "Form not found." }, 404);
    const body = (await request.json().catch(() => ({}))) as { values?: unknown; created_at?: string };
    const g = await getGlobalSettings();
    const blocks = await getBlocks(id);
    const { values } = collect(blocks, rawFromValues(body.values), {}, g, false);
    const when = body.created_at ? new Date(body.created_at) : null;
    const created = await insertResponse(id, values, {
      origin: "admin",
      channel: "manual",
      userId: user.id,
      createdAt: when && !Number.isNaN(when.getTime()) ? when : undefined,
    });
    return json((await getResponse(created.id)) ?? {}, 201);
  });
}
