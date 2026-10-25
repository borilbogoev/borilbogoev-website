import { getNav } from "@/modules/settings/lib/menu";
import { HeaderNav } from "./header-nav";

export async function SiteHeader() {
  return <HeaderNav items={await getNav()} />;
}
