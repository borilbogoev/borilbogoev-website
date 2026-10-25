// The menu's shape and rules. No database or server imports: the admin editor (a client component) uses this too.
import { site } from "@/content/site";

/**
 * The main menu. Page items are fixed (they can be switched on or off and moved); links are free
 * (title, address, target) and can be created, edited, deleted and moved. Stored as one JSON value
 * in `bbforms_settings` under the name below, so no table of its own.
 */
export const MENU_SETTING = "site_menu";

export const PAGE_ITEMS = {
  streamliner: { label: "The Streamliner", href: site.streamliner },
  sessions: { label: "Sessions", href: "/sessions" },
  school: { label: "School", href: "/school" },
  screening: { label: "Screening", href: "/screening" },
  sprint: { label: "Sprint", href: "/sprint" },
  shift: { label: "Shift", href: "/shift" },
  subscription: { label: "Subscription", href: "/subscription" },
  about: { label: "Boril", href: "/about" },
} as const;
export type PageKey = keyof typeof PAGE_ITEMS;
const PAGE_KEYS = Object.keys(PAGE_ITEMS) as PageKey[];

export type MenuTarget = "_self" | "_blank";
export type MenuEntry =
  | { id: string; type: "page"; key: PageKey; enabled: boolean }
  | { id: string; type: "link"; title: string; url: string; target: MenuTarget; enabled: boolean };

export function defaultMenu(): MenuEntry[] {
  return PAGE_KEYS.map((key) => ({ id: key, type: "page", key, enabled: true }));
}

/** Allowed addresses: a path on this site, http(s), mailto or tel. Anything else (javascript:, data:) is refused. */
export function isValidUrl(url: string): boolean {
  if (url.length > 500 || /\s/.test(url)) return false;
  if (url.startsWith("/")) return !url.startsWith("//");
  return /^(https?:\/\/[^/\s]+|mailto:[^\s]+|tel:[^\s]+)/i.test(url);
}

/**
 * Turns whatever was stored or posted into a valid menu: unknown pages dropped, duplicates dropped, missing pages
 * appended (on), invalid links dropped. With `strict` it throws on an invalid link instead, so the editor can say why.
 */
export function sanitizeMenu(input: unknown, strict = false): MenuEntry[] {
  const list = Array.isArray(input) ? input : [];
  const out: MenuEntry[] = [];
  const seenPages = new Set<string>();
  const seenIds = new Set<string>();
  for (const raw of list.slice(0, 60)) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const enabled = r.enabled !== false;
    if (r.type === "page") {
      const key = r.key as PageKey;
      if (!PAGE_KEYS.includes(key) || seenPages.has(key)) continue;
      seenPages.add(key);
      out.push({ id: key, type: "page", key, enabled });
    } else if (r.type === "link") {
      const title = typeof r.title === "string" ? r.title.trim().slice(0, 60) : "";
      const url = typeof r.url === "string" ? r.url.trim() : "";
      if (!title || !isValidUrl(url)) {
        if (strict) throw new Error(!title ? "Every link needs a title." : `"${title}" needs a valid URL: a path starting with /, or https://, mailto: or tel:.`);
        continue;
      }
      let id = typeof r.id === "string" && /^[\w-]{1,40}$/.test(r.id) && !PAGE_KEYS.includes(r.id as PageKey) ? r.id : `l-${out.length}-${Date.now().toString(36)}`;
      while (seenIds.has(id)) id += "x";
      seenIds.add(id);
      out.push({ id, type: "link", title, url, target: r.target === "_blank" ? "_blank" : "_self", enabled });
    }
  }
  for (const key of PAGE_KEYS) if (!seenPages.has(key)) out.push({ id: key, type: "page", key, enabled: true });
  return out;
}

