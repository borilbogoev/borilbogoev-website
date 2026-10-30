import { emailReady } from "@/modules/email/lib/config";
import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db/use";
import { requireUser } from "@/modules/auth/current";
import { GlobalSettingsEditor } from "@/modules/forms/admin/global-settings";
import { storageConfigured } from "@/modules/forms/lib/storage";
import { getGlobalSettings } from "@/modules/forms/lib/settings-store";
import { PageHeader } from "../../header";

export const metadata = { title: "Forms settings" };

const TABLES = ["bbforms_forms", "bbforms_blocks", "bbforms_responses", "bbforms_answers", "bbforms_stats", "bbforms_settings"];

export default async function FormsSettingsPage() {
  await requireUser("forms.settings", "/admin/forms/settings");
  const settings = await getGlobalSettings();
  const tables = await Promise.all(
    TABLES.map(async (name) => {
      try {
        const [r] = rowsOf<{ n: number }>(await db().execute(sql`SELECT COUNT(*)::int AS n FROM ${sql.identifier(name)}`));
        return { name, rows: Number(r?.n ?? 0) };
      } catch {
        return { name, rows: null };
      }
    }),
  );
  const zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  const timeZones = Array.from(new Set(["UTC", ...zones]));
  return (
    <>
      <PageHeader eyebrow="Configuration" title={<>Settings<span className="bbfa-dot">.</span></>} />
      <GlobalSettingsEditor initial={settings} tables={tables} timeZones={timeZones} storageReady={storageConfigured()} emailReady={await emailReady()} />
    </>
  );
}
