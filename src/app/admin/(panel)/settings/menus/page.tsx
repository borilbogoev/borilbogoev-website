import { requireUser } from "@/modules/auth/current";
import { MenuEditor } from "@/modules/settings/admin/menu-editor";
import { getMenuEntries } from "@/modules/settings/lib/menu";
import { SCHOOL_LISTED } from "@/modules/school/lib/listing";

export const metadata = { title: "Menus" };

export default async function MenusPage() {
  await requireUser("settings.manage", "/admin/settings/menus");
  const menu = await getMenuEntries();
  return <MenuEditor initial={menu} schoolListed={SCHOOL_LISTED} />;
}
