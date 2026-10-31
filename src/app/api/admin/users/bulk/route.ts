import { guarded, json } from "@/modules/auth/guard";
import { parseScope } from "@/modules/users/lib/filter";
import { BulkError, runBulk } from "@/modules/users/server/bulk";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Body: { scope: { ids: [...] } | { filter: {...} }, action, ...params }. The filter form applies to every page of results. */
export async function POST(request: Request) {
  return guarded(request, "users.manage", async (actor) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const scope = parseScope(body.scope);
    if (!scope) return json({ error: "Select at least one user." }, 400);
    try {
      return json(await runBulk(actor, scope, body), 200);
    } catch (e) {
      if (e instanceof BulkError) return json({ error: e.message }, e.status);
      throw e;
    }
  });
}
