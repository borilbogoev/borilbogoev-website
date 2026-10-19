import { revalidatePath } from "next/cache";
import { guarded, json } from "@/modules/auth/guard";
import { deleteForm, getBlocks, getForm, saveBlocks, updateForm, type BlockInput } from "@/modules/forms/lib/forms";
import { fieldsOf } from "@/modules/forms/lib/blocks";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

async function payload(id: number) {
  const form = await getForm(id);
  if (!form) return null;
  const blocks = await getBlocks(id);
  return { form: { ...form, createdAt: form.createdAt.toISOString(), updatedAt: form.updatedAt.toISOString() }, blocks, fields: fieldsOf(blocks).map(({ block, ...f }) => ({ ...f, blockId: block.id })) };
}

export async function GET(request: Request, ctx: Ctx) {
  return guarded(request, "forms.view", async () => {
    const data = await payload(Number((await ctx.params).id));
    return data ? json(data, 200) : json({ error: "Form not found." }, 404);
  });
}

export async function PUT(request: Request, ctx: Ctx) {
  return guarded(request, "forms.write", async () => {
    const id = Number((await ctx.params).id);
    const before = await getForm(id);
    if (!before) return json({ error: "Form not found." }, 404);
    const body = (await request.json().catch(() => null)) as { title?: string; status?: string; slug?: string | null; settings?: unknown; blocks?: BlockInput[] } | null;
    if (!body) return json({ error: "Invalid request." }, 400);

    const res = await updateForm(id, { title: body.title, status: body.status, slug: body.slug, settings: body.settings });
    if (!res.ok) return json({ error: res.error }, 409);
    if (Array.isArray(body.blocks)) await saveBlocks(id, body.blocks);

    const after = await getForm(id);
    for (const slug of new Set([before.slug, after?.slug])) if (slug) revalidatePath(`/s/${slug}`);
    return json((await payload(id)) ?? {}, 200);
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return guarded(request, "forms.delete", async () => {
    const id = Number((await ctx.params).id);
    const form = await getForm(id);
    await deleteForm(id);
    if (form?.slug) revalidatePath(`/s/${form.slug}`);
    return json({ deleted: true }, 200);
  });
}
