import { guarded, json } from "@/modules/auth/guard";
import { parseScope } from "@/modules/users/lib/filter";
import { exportCsv } from "@/modules/users/server/export";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Body: { scope, columns: [...] }. Returns the CSV file. */
export async function POST(request: Request) {
  return guarded(request, "users.manage", async () => {
    const body = (await request.json().catch(() => ({}))) as { scope?: unknown; columns?: unknown };
    const scope = parseScope(body.scope);
    if (!scope) return json({ error: "Nothing to export." }, 400);
    const columns = Array.isArray(body.columns) ? body.columns.filter((c): c is string => typeof c === "string") : [];
    try {
      const { csv, rows } = await exportCsv(scope, columns);
      return new Response(csv, {
        status: 200,
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`, "X-Rows": String(rows), "Cache-Control": "no-store" },
      });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "Export failed." }, 400);
    }
  });
}
