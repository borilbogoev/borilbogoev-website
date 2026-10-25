import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/current";

export default async function SettingsHome() {
  await requireUser("settings.manage", "/admin/settings");
  redirect("/admin/settings/menus");
}
