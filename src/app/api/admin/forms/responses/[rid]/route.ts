import { guarded, json } from "@/modules/auth/guard";
import { can } from "@/modules/auth/roles";
import { getBlocks } from "@/modules/forms/lib/forms";
import { deleteResponses, getResponse, markRead, updateValues, type Values } from "@/modules/forms/lib/responses";
import { getGlobalSettings } from "@/modules/forms/lib/settings-store";
import { collect } from "@/modules/forms/lib/submit";
import { rawFromValues } from "@/modules/forms/lib/admin-query";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ rid: string }> };

export async function GET(request: Request, ctx: Ctx) {
  return guarded(request, "forms.view", async (user) => {
    const r = await getResponse(Number((await ctx.params).rid));
    if (!r) return json({ error: "Response not found." }, 404);
    // Opening a record marks it as read, but only for roles that may change records.
    if (!r.is_read && can(user.role, "responses.write")) {
      await markRead(r.id, true);
      r.is_read = true;
    }
    return json(r, 200);
  });
}

export async function PUT(request: Request, ctx: Ctx) {
  return guarded(request, "responses.write", async () => {
    const r = await getResponse(Number((await ctx.params).rid));
    if (!r) return json({ error: "Response not found." }, 404);
    const body = (await request.json().catch(() => ({}))) as { values?: unknown; created_at?: string };
    const g = await getGlobalSettings();
    const { values } = collect(await getBlocks(r.form_id), rawFromValues(body.values), {}, g, false);
    // Keep the values of fields that are no longer part of the form.
    const merged: Values = { ...values };
    for (const [k, v] of Object.entries(r.values)) if (!(k in merged)) merged[k] = v;
    const when = body.created_at ? new Date(body.created_at) : null;
    await updateValues(r.id, r.form_id, merged, when && !Number.isNaN(when.getTime()) ? when : null);
    return json((await getResponse(r.id)) ?? {}, 200);
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return guarded(request, "responses.delete", async () => json({ deleted: await deleteResponses([Number((await ctx.params).rid)]) }, 200));
}
