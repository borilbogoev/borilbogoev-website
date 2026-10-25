import { PageHeader } from "../header";
import { SettingsTabs } from "@/modules/settings/admin/tabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title={
          <>
            Settings<span className="bbfa-dot">.</span>
          </>
        }
      />
      <SettingsTabs />
      {children}
    </>
  );
}
