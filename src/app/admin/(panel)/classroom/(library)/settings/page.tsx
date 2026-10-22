import { requireUser } from "@/modules/auth/current";
import { ClassroomSettingsEditor } from "@/modules/classroom/admin/settings-editor";
import { ClassroomTabs } from "@/modules/classroom/admin/library-header";
import { CURRENCIES } from "@/modules/classroom/lib/settings";
import { getSettings, hasBunnyKey } from "@/modules/classroom/lib/settings-store";
import { PageHeader } from "../../../header";

export const metadata = { title: "Classroom settings" };

export default async function ClassroomSettingsPage() {
  const user = await requireUser("classroom.settings", "/admin/classroom/settings");
  const [settings, saved] = await Promise.all([getSettings(), hasBunnyKey().catch(() => false)]);
  return (
    <>
      <PageHeader
        eyebrow="Classroom"
        title={
          <>
            Settings<span className="bbfa-dot">.</span>
          </>
        }
      />
      <ClassroomTabs role={user.role} />
      <ClassroomSettingsEditor initial={settings} bunnyKeySaved={saved} currencies={CURRENCIES} />
    </>
  );
}
