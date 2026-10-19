import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db/use";
import { guarded, json } from "@/modules/auth/guard";
import { deleteResponses, getResponse, idsForEmail } from "@/modules/forms/lib/responses";
import { cleanEmail } from "@/modules/forms/lib/sanitize";

export const runtime = "nodejs";

// Personal data tools (GDPR): find, export or erase every response that contains an email address.
export async function POST(request: Request) {
  return guarded(request, "forms.settings", async () => {
    const body = (await request.json().catch(() => ({}))) as { email?: string; action?: string };
    const email = cleanEmail(body.email);
    if (!email) return json({ error: "Enter a valid email address." }, 400);
    const ids = await idsForEmail(email);
    if (body.action === "erase") return json({ erased: await deleteResponses(ids) }, 200);

    const out = [];
    for (const id of ids) {
      const r = await getResponse(id);
      if (!r) continue;
      const [form] = rowsOf<{ title: string }>(await db().execute(sql`SELECT title FROM bbforms_forms WHERE id = ${r.form_id}`));
      out.push({ form: form?.title ?? r.form_id, submitted: r.created_at, answers: r.values });
    }
    return json({ count: out.length, responses: out }, 200);
  });
}
