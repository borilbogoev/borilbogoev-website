// Small helpers shared by the services: the database, errors, raw SQL results, id lists.
import { sql, type SQL } from "drizzle-orm";
import { db, rowsOf } from "@/db/use";

export { db, rowsOf };

/** An error the API turns into a JSON response with this status. Messages are safe to show. */
export class CommunityError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 429,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const notFound = () => new CommunityError(404, "Not found.");
export const forbidden = (message = "You can't do that.") => new CommunityError(403, message);
export const invalid = (message = "Check what you entered and try again.") => new CommunityError(400, message);

/** Postgres unique violation, however the driver wraps it. */
export function isUniqueViolation(e: unknown): boolean {
  const x = e as { code?: string; cause?: { code?: string }; message?: string } | null;
  return x?.code === "23505" || x?.cause?.code === "23505" || /duplicate key|unique constraint/i.test(String(x?.message ?? ""));
}

export async function run<T = Record<string, unknown>>(query: SQL): Promise<T[]> {
  return rowsOf<T>(await db().execute(query));
}

/** `ARRAY[1,2,3]::int[]`, or an empty array. Arrays cannot be passed as one parameter through every driver. */
export function intArray(ids: number[]): SQL {
  return ids.length ? sql`ARRAY[${sql.join(ids.map((i) => sql`${i}`), sql`, `)}]::int[]` : sql`ARRAY[]::int[]`;
}
export function uuidArray(ids: string[]): SQL {
  return ids.length ? sql`ARRAY[${sql.join(ids.map((i) => sql`${i}`), sql`, `)}]::uuid[]` : sql`ARRAY[]::uuid[]`;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/** Positive integer from a path or query value, or null. */
export function toId(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,9}$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Postgres returns timestamps as strings through `execute`; the typed builder returns Dates. */
export const asDate = (v: unknown): Date => (v instanceof Date ? v : new Date(String(v)));

/** Throws the right error for a refused permission decision. */
export const unwrap = (d: { ok: true } | { ok: false; code: string; message: string }) => {
  if (!d.ok) throw d.code === "not_found" ? notFound() : forbidden(d.message);
};
