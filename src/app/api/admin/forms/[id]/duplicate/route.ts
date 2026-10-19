import { guarded, json } from "@/modules/auth/guard";
import { duplicateForm } from "@/modules/forms/lib/forms";

export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return guarded(request, "forms.write", async (user) => {
    const id = await duplicateForm(Number((await ctx.params).id), user.id);
    return id ? json({ id }, 201) : json({ error: "Form not found." }, 404);
  });
}
