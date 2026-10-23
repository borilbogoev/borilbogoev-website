import { requireUser } from "@/modules/auth/current";
import { SchoolSettingsEditor } from "@/modules/school/admin/settings-editor";
import { SchoolTabs } from "@/modules/school/admin/library-header";
import { CURRENCIES } from "@/modules/school/lib/settings";
import { getSettings, hasBunnyKey } from "@/modules/school/lib/settings-store";
import { PageHeader } from "../../../header";

export const metadata = { title: "School settings" };

export default async function SchoolSettingsPage() {
  const user = await requireUser("school.settings", "/admin/school/settings");
  const [settings, saved] = await Promise.all([getSettings(), hasBunnyKey().catch(() => false)]);
  return (
    <>
      <PageHeader
        eyebrow="School"
        title={
          <>
            Settings<span className="bbfa-dot">.</span>
          </>
        }
      />
      <SchoolTabs role={user.role} />
      <SchoolSettingsEditor initial={settings} bunnyKeySaved={saved} currencies={CURRENCIES} />
    </>
  );
}
