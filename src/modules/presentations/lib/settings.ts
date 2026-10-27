// Settings of one presentation (stored as JSON in presentations.settings), plus the columns that have their own meaning.
import { cleanLink, cleanText, cleanUrl, toBool } from "@/modules/forms/lib/sanitize";

/** draft: not public, Present view only. active: live. inactive: the link shows "not available". archived: hidden, kept for the numbers. */
export const DECK_STATUSES = ["draft", "active", "inactive", "archived"] as const;
export type DeckStatus = (typeof DECK_STATUSES)[number];
export const STATUS_LABELS: Record<DeckStatus, string> = { draft: "Draft", active: "Active", inactive: "Inactive", archived: "Archived" };
export const STATUS_HELP: Record<DeckStatus, string> = {
  draft: "Draft: not public, visible in the Present view only",
  active: "Active: live at the address below",
  inactive: "Inactive: the link shows that it is not available right now",
  archived: "Archived: not public (404), kept for the numbers",
};

/** How the deck opens. Slides: one at a time, full width and height. Accordion: a long page whose sections fold open and shut. */
export const DECK_MODES = ["slides", "accordion"] as const;
export type DeckMode = (typeof DECK_MODES)[number];
export const MODE_LABELS: Record<DeckMode, string> = { slides: "Slides", accordion: "Accordion" };

/** Landscape fills the window. Portrait is a tall phone-shaped column. Auto follows the window. */
export const DECK_ORIENTATIONS = ["landscape", "portrait", "auto"] as const;
export type DeckOrientation = (typeof DECK_ORIENTATIONS)[number];
export const ORIENTATION_LABELS: Record<DeckOrientation, string> = {
  landscape: "Landscape: fills the window",
  portrait: "Portrait: a tall column for phones held upright",
  auto: "Auto: landscape on a wide window, portrait on a tall one",
};

export type DeckSettings = {
  /** A light line under the title in accordion mode and on the password screen. */
  subtitle: string;
  seo_title: string;
  seo_description: string;
  /** Picture shown when the link is shared (1200 x 630). */
  og_image: string;
  /** 1: search engines may list the deck and it is in the sitemap. 0 (default): link-only. */
  indexable: number;
  lang: "en" | "bg";
  theme: "light" | "dark";
  /** standard: compact type. large: the big presentation type of the brand slides (72 px headings on a 1920 px slide). */
  scale: "standard" | "large";
  transition: "none" | "fade" | "slide";
  progress: number;
  counter: number;
  arrows: number;
  outline: number;
  /** brand: the B* mark and the slide number. minimal: the number only. none: nothing. */
  footer: "brand" | "minimal" | "none";
  /** Viewers can switch between Slides and Accordion. */
  allow_switch: number;
  /** Accordion: several sections may stay open together. */
  accordion_multi: number;
  /** Seconds before the next slide appears by itself. 0 is off. */
  autoplay: number;
  loop: number;
  track: number;
  exclude_staff: number;
  /** Where visitors go while the deck is a draft or archived. Empty shows a 404. */
  closed_redirect: string;
  /** Text on the page shown while the deck is inactive. */
  closed_message: string;
  note: string;
};

export function deckSettingsDefaults(): DeckSettings {
  return {
    subtitle: "",
    seo_title: "",
    seo_description: "",
    og_image: "",
    indexable: 0,
    lang: "en",
    theme: "light",
    scale: "standard",
    transition: "fade",
    progress: 1,
    counter: 1,
    arrows: 1,
    outline: 1,
    footer: "brand",
    allow_switch: 1,
    accordion_multi: 1,
    autoplay: 0,
    loop: 0,
    track: 1,
    exclude_staff: 1,
    closed_redirect: "",
    closed_message: "",
    note: "",
  };
}

export function sanitizeDeckSettings(input: unknown, base: DeckSettings = deckSettingsDefaults()): DeckSettings {
  const s = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const d = { ...base };
  const has = (k: string) => k in s;
  const flag = (k: keyof DeckSettings) => {
    if (has(k)) (d[k] as number) = toBool(s[k]) ? 1 : 0;
  };
  if (has("subtitle")) d.subtitle = cleanText(s.subtitle, 200);
  if (has("seo_title")) d.seo_title = cleanText(s.seo_title, 120);
  if (has("seo_description")) d.seo_description = cleanText(s.seo_description, 320);
  if (has("og_image")) d.og_image = cleanUrl(s.og_image);
  if (has("lang")) d.lang = s.lang === "bg" ? "bg" : "en";
  if (has("theme")) d.theme = s.theme === "dark" ? "dark" : "light";
  if (has("scale")) d.scale = s.scale === "large" ? "large" : "standard";
  if (has("transition")) d.transition = s.transition === "none" || s.transition === "slide" ? s.transition : "fade";
  if (has("footer")) d.footer = s.footer === "minimal" || s.footer === "none" ? s.footer : "brand";
  if (has("autoplay")) d.autoplay = Math.max(0, Math.min(300, Math.round(Number(s.autoplay)) || 0));
  if (has("closed_redirect")) d.closed_redirect = cleanLink(s.closed_redirect);
  if (has("closed_message")) d.closed_message = cleanText(s.closed_message, 300);
  if (has("note")) d.note = cleanText(s.note, 500);
  for (const k of ["indexable", "progress", "counter", "arrows", "outline", "allow_switch", "accordion_multi", "loop", "track", "exclude_staff"] as const) flag(k);
  return d;
}

export function cleanStatus(v: unknown): DeckStatus | null {
  return (DECK_STATUSES as readonly string[]).includes(String(v)) ? (v as DeckStatus) : null;
}
export const cleanMode = (v: unknown): DeckMode => (v === "accordion" ? "accordion" : "slides");
export const cleanOrientation = (v: unknown): DeckOrientation => (v === "portrait" || v === "auto" ? v : "landscape");
