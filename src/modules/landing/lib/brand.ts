// Brand check for a landing page: the copy and layout rules of the BORILBOGOEV design system, as warnings.
// It never blocks a save. The builder shows the result, and the CLI prints it, so a page is fixed before it goes live.
import { LANDING_BLOCKS, type LandingBlock, type Settings } from "./blocks";
import type { LandingSettings } from "./settings";

export type BrandIssue = { level: "warn" | "info"; blockId?: number; blockType?: string; message: string };

const HYPE = /\b(revolutionary|game[- ]chang\w*|cutting[- ]edge|unlock\w*|supercharg\w*|skyrocket\w*|next[- ]level|world[- ]class|groundbreaking|disrupt\w*|10x|ultimate|secret sauce|mind[- ]blowing)\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;
const LONG_DASH = /[–—]/;
const BUTTON_KEYS = new Set(["cta_label", "secondary_label", "button_label", "link_label", "label"]);
const SKIP_KEYS = new Set(["url", "cta_url", "secondary_url", "button_url", "link_url", "sticky_url", "anchor", "target", "icon", "style", "size", "bg", "spacing", "hide", "align", "layout", "columns", "ratio", "display", "theme", "width", "length", "mark", "image_side", "image_style", "per_view", "level", "href"]);

type Text = { key: string; value: string };

/** Every in-page link (#name) used by a block's link settings. */
function anchorLinks(value: unknown, key = "", out: string[] = []): string[] {
  if (typeof value === "string") {
    if (/(^|_)(url|link)$/.test(key) && /^#[A-Za-z][\w-]*$/.test(value.trim())) out.push(value.trim().slice(1));
  } else if (Array.isArray(value)) {
    for (const v of value) anchorLinks(v, key, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Settings)) anchorLinks(v, k, out);
  }
  return out;
}

function strings(value: unknown, key = "", out: Text[] = []): Text[] {
  if (typeof value === "string") {
    if (value && !SKIP_KEYS.has(key) && !/^(\/|#|https?:|mailto:|tel:)/i.test(value.trim())) out.push({ key, value });
  } else if (Array.isArray(value)) {
    for (const v of value) strings(v, key, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Settings)) strings(v, k, out);
  }
  return out;
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function brandIssues(blocks: LandingBlock[], settings: LandingSettings): BrandIssue[] {
  const out: BrandIssue[] = [];
  const add = (level: BrandIssue["level"], message: string, b?: LandingBlock) => out.push({ level, message, blockId: b?.id || undefined, blockType: b?.type });
  const name = (b: LandingBlock) => LANDING_BLOCKS[b.type].label;

  for (const b of blocks) {
    const seen = new Set<string>();
    for (const { key, value } of strings(b.settings)) {
      const flag = (rule: string, message: string) => {
        if (seen.has(rule)) return;
        seen.add(rule);
        add("warn", `${name(b)}: ${message}`, b);
      };
      if (EMOJI.test(value)) flag("emoji", "remove the emoji. The brand uses outline icons only.");
      if (value.includes("!")) flag("bang", "remove the exclamation mark. The brand tone is calm and exact.");
      if (LONG_DASH.test(value)) flag("dash", 'replace the long dash with a comma, a colon or "to".');
      const hype = HYPE.exec(value);
      if (hype) flag(`hype:${hype[0].toLowerCase()}`, `replace the hype word "${hype[0]}" with a concrete claim.`);
      if (BUTTON_KEYS.has(key) && words(value) > 4) flag(`btn:${value}`, `shorten the button "${value}" to two or three words.`);
      if (/^[A-Z0-9\s.,:;'"&-]{12,}$/.test(value) && /[A-Z]{4}/.test(value) && key !== "badge" && key !== "label" && key !== "eyebrow") flag(`caps:${value}`, `"${value}" is in capitals. Write headings in sentence case; the eyebrow is capitalised by the style.`);
    }

    // One red primary button per block.
    const primaries = b.type === "buttons" ? (b.settings.items as Settings[]).filter((i) => i.style === "primary" && i.label).length : 0;
    if (primaries > 1) add("warn", `${name(b)}: more than one red primary button. Keep one red action per view and make the other an outline or a text link.`, b);

    // Pictures need a description.
    const needsAlt = (b.type === "image" && b.settings.image?.url && !b.settings.alt) || (b.type === "hero_image" && b.settings.image?.url && !b.settings.image_alt) || (b.type === "bio" && b.settings.image?.url && !b.settings.image_alt);
    if (needsAlt) add("warn", `${name(b)}: add the image description (alt text) for screen readers and search.`, b);
    if (b.type === "cards" || b.type === "gallery" || b.type === "carousel") {
      const missing = (b.settings.items as Settings[]).filter((i) => i.image?.url && !(i.alt || i.image_alt)).length;
      if (missing) add("info", `${name(b)}: ${missing} image${missing > 1 ? "s have" : " has"} no description (alt text).`, b);
    }
    if (b.type === "form" && !(Number(b.settings.form_id) > 0)) add("warn", "Form: choose which form to show.", b);
    if (b.type === "video" && !b.settings.url) add("warn", "Video: add the video link.", b);
    if (b.type === "countdown" && !b.settings.target) add("warn", "Countdown: set the date and time.", b);
  }

  // Links to #anchors need a block that carries that anchor.
  const anchors = new Map<string, number>();
  for (const b of blocks) if (b.settings.anchor) anchors.set(String(b.settings.anchor), (anchors.get(String(b.settings.anchor)) ?? 0) + 1);
  for (const [a, n] of anchors) if (n > 1) add("warn", `Two blocks share the anchor #${a}. Anchors must be unique.`);
  const missing = new Set<string>();
  for (const b of blocks) for (const a of anchorLinks(b.settings)) if (!anchors.has(a)) missing.add(a);
  if (settings.sticky_url.startsWith("#") && settings.sticky_label) missing.add(settings.sticky_url.slice(1));
  for (const a of anchors.keys()) missing.delete(a);
  for (const a of missing) add("warn", `A link points to #${a}, but no block has that anchor. Set it under Layout and anchor.`);

  const h1s = blocks.filter((b) => b.type === "hero" || b.type === "hero_image" || (b.type === "heading" && b.settings.level === "h1"));
  if (!h1s.length) add("warn", "The page has no main headline. Start with a Hero block.");
  if (h1s.length > 1) add("warn", "More than one main headline (Hero or XL title). Keep one per page.");
  if (blocks.length && !["hero", "hero_image"].includes(blocks[0].type)) add("info", "The page does not open with a Hero. The first screen should state the promise.");
  const hasAction = blocks.some((b) => b.type === "form" || b.type === "cta" || b.type === "buttons" || b.type === "pricing" || ((b.type === "hero" || b.type === "hero_image") && b.settings.cta_label));
  if (blocks.length && !hasAction) add("warn", "The page has no action: add a Form, a Call to action or Buttons.");
  const dark = blocks.filter((b) => b.settings.bg === "inverse" || b.settings.style === "inverse").length;
  if (dark > 3) add("info", `${dark} dark bands. The brand uses one or two as full stops.`);
  if (!settings.seo_description) add("info", "Add a search and share description in Settings.");
  return out;
}
