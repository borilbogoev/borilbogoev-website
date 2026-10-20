// Settings of one landing page (stored as JSON in landing_pages.settings).
import { cleanLink, cleanText, cleanUrl, toBool } from "@/modules/forms/lib/sanitize";

export const PAGE_STATUSES = ["draft", "published", "archived"] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];

export const STATUS_LABELS: Record<PageStatus, string> = { draft: "Draft", published: "Published", archived: "Archived" };

export type LandingSettings = {
  /** Browser tab and search title. Empty uses the page name. */
  seo_title: string;
  seo_description: string;
  /** Picture shown when the link is shared (1200 x 630). */
  og_image: string;
  /** 1: search engines may list the page and it is in the sitemap. 0 (default): ad and email traffic only. */
  indexable: number;
  lang: "en" | "bg";
  /** none: the page alone. minimal: the B* mark on top. full: the site header and footer. */
  chrome: "none" | "minimal" | "full";
  /** A bar fixed to the bottom of phone screens with one action. Empty label turns it off. */
  sticky_label: string;
  sticky_url: string;
  track: number;
  /** Do not count visits by signed-in admins. */
  exclude_staff: number;
  /** Where visitors go while the page is a draft or archived. Empty shows a 404. */
  closed_redirect: string;
  note: string;
};

export const CHROME_CHOICES: Record<LandingSettings["chrome"], string> = {
  none: "None: the page alone (best for conversion)",
  minimal: "Minimal: the B* mark on top",
  full: "Full: site header and footer",
};

export function landingSettingsDefaults(): LandingSettings {
  return {
    seo_title: "",
    seo_description: "",
    og_image: "",
    indexable: 0,
    lang: "en",
    chrome: "minimal",
    sticky_label: "",
    sticky_url: "#form",
    track: 1,
    exclude_staff: 1,
    closed_redirect: "",
    note: "",
  };
}

export function sanitizeLandingSettings(input: unknown, base: LandingSettings = landingSettingsDefaults()): LandingSettings {
  const s = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const d = { ...base };
  const has = (k: string) => k in s;
  if (has("seo_title")) d.seo_title = cleanText(s.seo_title, 120);
  if (has("seo_description")) d.seo_description = cleanText(s.seo_description, 320);
  if (has("og_image")) d.og_image = cleanUrl(s.og_image);
  if (has("indexable")) d.indexable = toBool(s.indexable) ? 1 : 0;
  if (has("lang")) d.lang = s.lang === "bg" ? "bg" : "en";
  if (has("chrome")) d.chrome = s.chrome === "none" || s.chrome === "full" ? s.chrome : "minimal";
  if (has("sticky_label")) d.sticky_label = cleanText(s.sticky_label, 40);
  if (has("sticky_url")) d.sticky_url = cleanLink(s.sticky_url) || "#form";
  if (has("track")) d.track = toBool(s.track) ? 1 : 0;
  if (has("exclude_staff")) d.exclude_staff = toBool(s.exclude_staff) ? 1 : 0;
  if (has("closed_redirect")) d.closed_redirect = cleanLink(s.closed_redirect);
  if (has("note")) d.note = cleanText(s.note, 500);
  return d;
}
