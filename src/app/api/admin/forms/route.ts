import { guarded, json } from "@/modules/auth/guard";
import { createForm, listForms } from "@/modules/forms/lib/forms";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return guarded(request, "forms.view", async () => json({ forms: await listForms(new URL(request.url).searchParams.get("q") ?? "") }, 200));
}

export async function POST(request: Request) {
  return guarded(request, "forms.write", async (user) => {
    const body = (await request.json().catch(() => ({}))) as { title?: string; template?: string };
    const id = await createForm(String(body.title ?? ""), String(body.template ?? "blank"), user.id);
    return json({ id }, 201);
  });
}
