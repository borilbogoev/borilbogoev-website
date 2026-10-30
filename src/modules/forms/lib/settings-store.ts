import { eq, inArray } from "drizzle-orm";
import { schema } from "@/db";
import { db } from "@/db/use";
import { globalDefaults, sanitizeGlobalSettings, type GlobalSettings } from "./settings";

const { bbformsSettings: table } = schema;

/** Global Forms settings: defaults overlaid with whatever is stored in `bbforms_settings`. */
export async function getGlobalSettings(): Promise<GlobalSettings> {
  const rows = await db().select().from(table);
  const stored: Record<string, unknown> = {};
  for (const r of rows) stored[r.name] = r.value;
  return sanitizeGlobalSettings(stored);
}

export async function saveGlobalSettings(input: unknown): Promise<GlobalSettings> {
  const current = await getGlobalSettings();
  const next = sanitizeGlobalSettings(input, current);
  // The sender and recipient belong to Admin > Settings > Email, which writes them. Saving Forms settings must not overwrite them.
  const known = (Object.keys(globalDefaults()) as (keyof GlobalSettings)[]).filter((k) => !k.startsWith("email_"));
  for (const name of known) {
    await db().insert(table).values({ name, value: next[name] }).onConflictDoUpdate({ target: table.name, set: { value: next[name] } });
  }
  return next;
}

export async function getStoredValue<T>(name: string): Promise<T | null> {
  const [r] = await db().select().from(table).where(eq(table.name, name)).limit(1);
  return (r?.value as T) ?? null;
}

export async function getStoredValues(names: string[]): Promise<Record<string, unknown>> {
  const rows = await db().select().from(table).where(inArray(table.name, names));
  return Object.fromEntries(rows.map((r) => [r.name, r.value]));
}
