import { SCHOOL_LISTED } from "@/modules/school/lib/listing";
import { nav as defaultNav, type NavItem } from "@/content/site";
import { MENU_SETTING, sanitizeMenu, PAGE_ITEMS, type MenuEntry } from "./menu-model";
import { getStoredValue } from "@/modules/forms/lib/settings-store";
import { db } from "@/db/use";
import { schema } from "@/db";

export * from "./menu-model";

export async function getMenuEntries(): Promise<MenuEntry[]> {
  return sanitizeMenu(await getStoredValue<unknown>(MENU_SETTING));
}

export async function saveMenuEntries(input: unknown): Promise<MenuEntry[]> {
  const menu = sanitizeMenu(input, true);
  await db().insert(schema.bbformsSettings).values({ name: MENU_SETTING, value: menu }).onConflictDoUpdate({ target: schema.bbformsSettings.name, set: { value: menu } });
  return menu;
}

/** The menu as the header draws it. Never throws: with no database or no saved menu it is the default menu. */
export async function getNav(): Promise<NavItem[]> {
  let entries: MenuEntry[] | null = null;
  try {
    entries = await getMenuEntries();
  } catch {
    // no database (local work, build without DATABASE_URL): fall through to the default
  }
  if (!entries) return defaultNav;
  const items: NavItem[] = [];
  for (const e of entries) {
    if (!e.enabled) continue;
    if (e.type === "link") {
      items.push({ kind: "link", label: e.title, href: e.url, newTab: e.target === "_blank" });
      continue;
    }
    if (e.key === "school" && !SCHOOL_LISTED) continue;
    const p = PAGE_ITEMS[e.key];
    items.push({ kind: e.key === "streamliner" ? "streamliner" : e.key === "about" ? "portrait" : "internal", label: e.key === "about" ? "About" : p.label, href: p.href });
  }
  return items;
}
