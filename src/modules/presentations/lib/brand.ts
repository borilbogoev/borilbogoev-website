// Brand check for a deck: the copy and layout rules of the BORILBOGOEV design system, as warnings.
// It never blocks a save. The builder shows the result, so a deck is fixed before it goes live.
import { SLIDE_KINDS, slideTitle, type DeckSlide } from "./slides";
import type { Settings } from "./elements";

export type BrandIssue = { level: "warn" | "info"; slideIndex?: number; message: string };

const HYPE = /\b(revolutionary|game[- ]chang\w*|cutting[- ]edge|unlock\w*|supercharg\w*|skyrocket\w*|next[- ]level|world[- ]class|groundbreaking|disrupt\w*|10x|ultimate|secret sauce|mind[- ]blowing)\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;
const LONG_DASH = /[–—]/;
const BUTTON_KEYS = new Set(["label"]);
const SKIP_KEYS = new Set(["url", "href", "icon", "style", "size", "bg", "layout", "align", "valign", "motif", "anchor", "kind", "col", "build", "marker", "tone", "fit", "shape", "ratio", "mode", "columns", "display", "color", "code", "rows", "notes"]);

type Text = { key: string; value: string; type?: string };

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

export function brandIssues(slides: DeckSlide[]): BrandIssue[] {
  const out: BrandIssue[] = [];
  const seenAnchors = new Set<string>();
  slides.forEach((slide, index) => {
    const where = `Slide ${index + 1} (${slideTitle(slide)})`;
    const add = (level: BrandIssue["level"], message: string) => out.push({ level, slideIndex: index, message: `${where}: ${message}` });
    const seen = new Set<string>();
    const flag = (rule: string, message: string) => {
      if (seen.has(rule)) return;
      seen.add(rule);
      add("warn", message);
    };
    const parts: Text[] = [...strings(slide.settings), ...slide.elements.flatMap((e) => strings(e.settings).map((t) => ({ ...t, type: e.type })))];
    for (const { key, value, type } of parts) {
      if (EMOJI.test(value)) flag("emoji", "remove the emoji. The brand uses outline icons only.");
      if (value.includes("!")) flag("bang", "remove the exclamation mark. The brand tone is calm and exact.");
      if (LONG_DASH.test(value)) flag("dash", 'replace the long dash with a comma, a colon or "to".');
      const hype = HYPE.exec(value);
      if (hype) flag(`hype:${hype[0].toLowerCase()}`, `replace the hype word "${hype[0]}" with a concrete claim.`);
      if (type === "button" && BUTTON_KEYS.has(key) && words(value) > 4) flag(`btn:${value}`, `shorten the button "${value}" to two or three words.`);
    }
    for (const e of slide.elements) {
      const s = e.settings;
      if (e.type === "image" && s.image?.url && !String(s.alt ?? "").trim()) flag("alt", "add a description (alt text) to the picture.");
      if (e.type === "gallery" && (s.items as Settings[]).some((i) => i.image?.url && !String(i.alt ?? "").trim())) flag("alt-gallery", "add a description (alt text) to every picture in the grid.");
      if (e.type === "video" && !s.url) flag("video-empty", "the video element has no link yet.");
      if (e.type === "embed" && !s.url) flag("embed-empty", "the interactive embed has no address yet.");
      if (e.type === "form" && !Number(s.form_id)) flag("form-empty", "the form element has no form chosen.");
      if (e.type === "image" && !s.image?.url) add("info", "an image element has no picture yet.");
      if (e.type === "heading" && s.eyebrow && s.eyebrow !== String(s.eyebrow).toUpperCase() && /[a-z]{14,}/.test(String(s.eyebrow))) add("info", `the eyebrow "${s.eyebrow}" is long. Keep it to two or three words.`);
    }
    const red = slide.elements.filter((e) => e.type === "button" && (e.settings.style === "primary") && e.settings.label).length;
    if (red > 1) flag("red", "more than one red primary button. Keep one call to action per slide.");
    if (slide.settings.anchor) {
      const a = String(slide.settings.anchor);
      if (seenAnchors.has(a)) flag("anchor", `the anchor #${a} is used by another slide.`);
      seenAnchors.add(a);
    }
    if (slide.settings.bg === "image" && !(slide.settings.bg_image as Settings)?.url) add("info", "the background is set to a picture but none is chosen.");
    const text = slide.elements.filter((e) => e.type === "text" || e.type === "bullets").length;
    const bulletCount = slide.elements.reduce((n, e) => n + (e.type === "bullets" ? ((e.settings.items as string[]) ?? []).length : 0), 0);
    if (bulletCount > 7) add("info", `${bulletCount} bullets is a lot for one slide. Split it or use Steps.`);
    if (text > 3) add("info", "many text blocks on one slide. One idea per slide reads better.");
    if (!slide.elements.length && slide.kind !== "blank") add("info", `${SLIDE_KINDS[slide.kind]?.label ?? "Slide"} has no elements.`);
  });
  return out;
}
