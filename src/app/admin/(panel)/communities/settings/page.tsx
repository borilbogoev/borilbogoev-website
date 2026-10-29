import { requireUser } from "@/modules/auth/current";
import { SettingsForm } from "@/modules/community/admin/panels";
import { AdminHead } from "@/modules/community/admin/head";
import { getUserById } from "@/modules/auth/users";
import { clearSettingsCache, getSettings } from "@/modules/community/server/settings";

export const metadata = { title: "Community settings" };

export default async function SettingsPage() {
  await requireUser("community.manage", "/admin/communities/settings");
  clearSettingsCache(); // the admin always sees the stored values
  const s = await getSettings();
  const who = s.updatedBy ? await getUserById(s.updatedBy) : null;
  return (
    <>
      <AdminHead title="Settings" />
      <SettingsForm
        initial={{ postingPaused: s.postingPaused, maxImagesPerPost: s.maxImagesPerPost, maxImageMb: s.maxImageMb, ratePostPerHour: s.ratePostPerHour, rateCommentPerHour: s.rateCommentPerHour, rateMessagePerMinute: s.rateMessagePerMinute }}
        updatedBy={who?.name || who?.email || ""}
        updatedAt={s.updatedAt ? s.updatedAt.toISOString() : null}
      />
    </>
  );
}
