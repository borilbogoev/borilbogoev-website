import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { getDb, schema } from "./index";

/** Any Drizzle Postgres database over our schema: Neon in production, PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let override: Db | null = null;

/** Tests inject an in-memory database here. */
export function setDbForTests(db: Db | null) {
  override = db;
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set.");
  }
}

/** The database for module code that cannot work without one. */
export function db(): Db {
  if (override) return override;
  const d = getDb();
  if (!d) throw new DatabaseNotConfiguredError();
  return d as unknown as Db;
}

/** Rows of a raw `db.execute()` result, whatever the driver returns. */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown })?.rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}
