import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { db } from "@/db/use";
import { decryptSecret, encryptSecret } from "./secrets";
import { sanitizeSettings, settingsDefaults, type SchoolSettings } from "./settings";

const { schoolSettings: table } = schema;
type SecretName = "bunny_token_key";

export async function getSettings(): Promise<SchoolSettings> {
  const rows = await db().select().from(table);
  const stored: Record<string, unknown> = {};
  for (const r of rows) stored[r.name] = r.value;
  return sanitizeSettings(stored);
}

export async function saveSettings(input: unknown): Promise<SchoolSettings> {
  const next = sanitizeSettings(input, await getSettings());
  for (const name of Object.keys(settingsDefaults()) as (keyof SchoolSettings)[]) {
    await db().insert(table).values({ name, value: next[name] }).onConflictDoUpdate({ target: table.name, set: { value: next[name] } });
  }
  return next;
}

async function secretRow(name: SecretName): Promise<string> {
  const [r] = await db().select().from(table).where(eq(table.name, name)).limit(1);
  return decryptSecret(r?.value);
}

/** The Bunny.net embed token key, or "" when none is saved. Server only. */
export const getBunnyKey = () => secretRow("bunny_token_key");
export const hasBunnyKey = async () => Boolean(await getBunnyKey().catch(() => ""));

/** Saves a secret. An empty string removes it; `undefined` leaves the saved one alone. */
export async function saveSecret(name: SecretName, value: string | undefined): Promise<void> {
  if (value === undefined) return;
  const stored = encryptSecret(value.trim());
  await db().insert(table).values({ name, value: stored }).onConflictDoUpdate({ target: table.name, set: { value: stored } });
}
