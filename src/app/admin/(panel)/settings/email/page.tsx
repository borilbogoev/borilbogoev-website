import { requireUser } from "@/modules/auth/current";
import { EmailSettingsEditor } from "@/modules/email/admin/email-settings";
import { getEmailLog } from "@/modules/email/lib/config";
import { templateInfos } from "@/modules/email/lib/templates";
import { emailView } from "@/modules/email/lib/view";

export const metadata = { title: "Email settings" };

export default async function EmailSettingsPage() {
  const user = await requireUser("settings.manage", "/admin/settings/email");
  const [view, log] = await Promise.all([emailView(), getEmailLog()]);
  return <EmailSettingsEditor initial={view} templates={templateInfos()} log={log} defaultTo={user.email} />;
}
