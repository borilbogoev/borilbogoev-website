// Slides: the layouts a deck is built from. A slide has settings (layout, background, notes, accordion title) and an ordered
// list of elements. The slide "kinds" below are starting points, like the layouts of a slide master: choosing one adds a slide
// with the right layout and pre-filled elements, and every element can then be changed, moved or removed.
import { defaultsFor, mergeDefaults, sanitizeFor } from "@/modules/forms/lib/blocks";
import { cleanSlug } from "@/modules/forms/lib/sanitize";
import { elementDefaults, elementWithDefaults, sanitizeElement, isElementType, type Control, type DeckElement, type ElementType, type Settings } from "./elements";

export type SlideKind =
  | "cover"
  | "section"
  | "agenda"
  | "bullets"
  | "text"
  | "statement"
  | "two_columns"
  | "compare"
  | "image_full"
  | "image_text"
  | "gallery"
  | "video"
  | "embed"
  | "demo"
  | "numbers"
  | "quote"
  | "cards"
  | "steps"
  | "table"
  | "code"
  | "person"
  | "logos"
  | "form"
  | "closing"
  | "questions"
  | "blank";

export type SlideGroup = "frame" | "content" | "media" | "proof" | "action";

export const SLIDE_GROUPS: Record<SlideGroup, string> = {
  frame: "Open and structure",
  content: "Content",
  media: "Media and demos",
  proof: "Proof and people",
  action: "Close",
};

export type DeckSlide = { id: number; kind: SlideKind; settings: Settings; elements: DeckElement[] };

const text = (key: string, label: string, def = "", help?: string): Control => ({ key, type: "text", label, default: def, help });
const select = (key: string, label: string, def: string, choices: Record<string, string>): Control => ({ key, type: "select", label, default: def, choices });
const toggle = (key: string, label: string, def = 0, help?: string): Control => ({ key, type: "toggle", label, default: def, help });

/** The settings every slide has. */
export const SLIDE_CONTROLS: Control[] = [
  text("title", "Slide name", "", "Shown in the outline and as the accordion title. Empty uses the first heading."),
  text("summary", "Accordion summary (one line)", "", "A short line under the title when the deck is shown as an accordion."),
  select("layout", "Layout", "stack", { stack: "One column", split: "Two columns, equal", split_text: "Two columns, wide left", split_media: "Two columns, wide right" }),
  select("align", "Alignment", "left", { left: "Left", center: "Centered" }),
  select("valign", "Vertical position", "center", { top: "Top", center: "Middle", bottom: "Bottom" }),
  select("bg", "Background", "surface", { surface: "White", alt: "Light grey", inverse: "Dark band", image: "Picture" }),
  { key: "bg_image", type: "image", label: "Background picture", default: { id: 0, url: "" } },
  { key: "bg_dim", type: "number", label: "Darken the picture (%)", default: 55, min: 0, max: 90 },
  toggle("bg_mono", "Greyscale picture", 1),
  select("motif", "Motif", "none", { none: "None", asterisk: "Large red asterisk (the brand's signature)" }),
  text("anchor", "Anchor (for #links)", "", "Letters, numbers and dashes. Link to this slide with #name."),
  toggle("hidden", "Skip this slide when presenting", 0, "Kept in the builder, hidden from viewers."),
  toggle("open", "Open by default (accordion)", 0),
  { key: "notes", type: "textarea", label: "Speaker notes", default: "", help: "Only you see these, in the Present view. They are never sent to viewers." },
];

/** Keys shown under "Look" in the slide inspector. */
export const SLIDE_LOOK_KEYS = new Set(["layout", "align", "valign", "bg", "bg_image", "bg_dim", "bg_mono", "motif"]);
export const SLIDE_ACCORDION_KEYS = new Set(["summary", "open"]);

export function slideDefaults(): Settings {
  return defaultsFor(SLIDE_CONTROLS);
}

export function sanitizeSlideSettings(input: unknown): Settings {
  const out = sanitizeFor(SLIDE_CONTROLS, input);
  if (typeof out.anchor === "string") out.anchor = cleanSlug(out.anchor).slice(0, 40);
  return out;
}

/* -------------------------------------------------------------------------- */
/* Kinds                                                                      */
/* -------------------------------------------------------------------------- */

type ElementSeed = [ElementType, Settings?];
export type SlideKindDef = { label: string; group: SlideGroup; icon: string; desc: string; settings: Settings; elements: ElementSeed[] };

export const SLIDE_KINDS: Record<SlideKind, SlideKindDef> = {
  cover: {
    label: "Cover",
    group: "frame",
    icon: "cover",
    desc: "The title slide: eyebrow, large title, a light line and who presents.",
    settings: { motif: "asterisk", valign: "center" },
    elements: [
      ["heading", { eyebrow: "Talk · Workshop", text: "Presentation title.", subtitle: "One light line that frames the talk.", size: "display", col: "all" }],
      ["text", { content: "Boril Bogoev, Ph.D. · Dubai · Month 2026", size: "meta", tone: "muted", col: "all" }],
    ],
  },
  section: {
    label: "Section",
    group: "frame",
    icon: "section",
    desc: "A dark divider between parts, with a mono number.",
    settings: { bg: "inverse", valign: "center", summary: "" },
    elements: [
      ["text", { content: "01", size: "meta", tone: "muted", col: "all" }],
      ["heading", { eyebrow: "Part one", text: "Section title.", size: "display_lg", col: "all" }],
    ],
  },
  agenda: {
    label: "Agenda",
    group: "frame",
    icon: "agenda",
    desc: "What the session covers, in numbered rows with the time of each part.",
    settings: { valign: "top" },
    elements: [
      ["heading", { eyebrow: "Agenda", text: "What we cover.", size: "h1", col: "all" }],
      ["steps", { layout: "list", col: "all", items: [{ title: "Context", text: "", meta: "10 min" }, { title: "The system", text: "", meta: "20 min" }, { title: "Live demo", text: "", meta: "15 min" }, { title: "Questions", text: "", meta: "15 min" }] }],
    ],
  },
  bullets: {
    label: "Title and bullets",
    group: "content",
    icon: "list",
    desc: "A heading and three to five points. The workhorse slide.",
    settings: { valign: "top" },
    elements: [
      ["heading", { eyebrow: "Topic", text: "The point of this slide.", size: "h1", col: "all" }],
      ["bullets", { items: ["First point, in one line", "Second point, in one line", "Third point, in one line"], size: "lg", col: "all" }],
    ],
  },
  text: {
    label: "Title and text",
    group: "content",
    icon: "text",
    desc: "A heading with a short paragraph.",
    settings: { valign: "top" },
    elements: [
      ["heading", { eyebrow: "Topic", text: "The point of this slide.", size: "h1", col: "all" }],
      ["text", { content: "Two or three sentences. Facts first, then the consequence.", size: "lg", col: "all" }],
    ],
  },
  statement: {
    label: "Big statement",
    group: "content",
    icon: "statement",
    desc: "One sentence on a dark band. The slide people remember.",
    settings: { bg: "inverse", valign: "center" },
    elements: [["heading", { eyebrow: "", text: "One sentence that makes the idea stick.", size: "display_lg", col: "all" }]],
  },
  two_columns: {
    label: "Two columns",
    group: "content",
    icon: "columns",
    desc: "Text on the left, points or a second idea on the right.",
    settings: { layout: "split", valign: "top" },
    elements: [
      ["heading", { eyebrow: "Topic", text: "The point of this slide.", size: "h1", col: "all" }],
      ["text", { content: "Explain the idea in two or three sentences.", size: "lg", col: "1" }],
      ["bullets", { items: ["First detail", "Second detail", "Third detail"], size: "md", col: "2" }],
    ],
  },
  compare: {
    label: "Before and after",
    group: "content",
    icon: "compare",
    desc: "Two cards side by side: old way and new way.",
    settings: { valign: "top" },
    elements: [
      ["heading", { eyebrow: "Difference", text: "Before and after.", size: "h1", col: "all" }],
      ["compare", { col: "all" }],
    ],
  },
  image_full: {
    label: "Full picture",
    group: "media",
    icon: "imagefull",
    desc: "A picture across the whole slide with one line over it.",
    settings: { bg: "image", valign: "bottom", bg_dim: 45 },
    elements: [["heading", { eyebrow: "", text: "A line that names the picture.", size: "h1", accent_dot: 1, col: "all" }]],
  },
  image_text: {
    label: "Picture and text",
    group: "media",
    icon: "imagetext",
    desc: "Text on the left, a picture on the right.",
    settings: { layout: "split", valign: "center" },
    elements: [
      ["heading", { eyebrow: "Topic", text: "The point of this slide.", size: "h1", col: "1" }],
      ["text", { content: "Two or three sentences that the picture supports.", size: "lg", col: "1" }],
      ["image", { fit: "cover", col: "2" }],
    ],
  },
  gallery: {
    label: "Picture grid",
    group: "media",
    icon: "gallery",
    desc: "Three pictures with captions: screens, steps, examples.",
    settings: { valign: "top" },
    elements: [
      ["heading", { eyebrow: "Examples", text: "What it looks like.", size: "h1", col: "all" }],
      ["gallery", { col: "all", columns: "3" }],
    ],
  },
  video: {
    label: "Video",
    group: "media",
    icon: "video",
    desc: "A video that fills the slide. Plays on click.",
    settings: { valign: "top" },
    elements: [
      ["heading", { eyebrow: "Watch", text: "What the video shows.", size: "h2", col: "all" }],
      ["video", { col: "all" }],
    ],
  },
  embed: {
    label: "Interactive embed",
    group: "media",
    icon: "embed",
    desc: "A live page inside the deck: a prototype, a board, a booking calendar.",
    settings: { valign: "top" },
    elements: [
      ["heading", { eyebrow: "Try it", text: "What the audience can do.", size: "h2", col: "all" }],
      ["embed", { col: "all", mode: "fill" }],
    ],
  },
  demo: {
    label: "Live demo",
    group: "media",
    icon: "demo",
    desc: "A dark pause before the demo. A button opens it in another tab, so the deck stays where it is.",
    settings: { bg: "inverse", valign: "center" },
    elements: [
      ["heading", { eyebrow: "Live demo", text: "What you are about to see.", size: "display_lg", col: "all" }],
      ["text", { content: "One line on what to watch for.", size: "lg", tone: "muted", col: "all" }],
      ["button", { label: "Open Demo", url: "", style: "primary", new_tab: 1, col: "all" }],
    ],
  },
  numbers: {
    label: "Numbers",
    group: "proof",
    icon: "numbers",
    desc: "Three big figures. Approximate and honest.",
    settings: { valign: "center" },
    elements: [
      ["heading", { eyebrow: "Results", text: "The numbers.", size: "h1", col: "all" }],
      ["stats", { col: "all" }],
    ],
  },
  quote: {
    label: "Quote",
    group: "proof",
    icon: "quote",
    desc: "A client sentence or a pulled quote on a dark band.",
    settings: { bg: "inverse", valign: "center" },
    elements: [["quote", { col: "all", size: "xl" }]],
  },
  cards: {
    label: "Three ideas",
    group: "content",
    icon: "features",
    desc: "Three or four cards, each with an outline icon.",
    settings: { valign: "top" },
    elements: [
      ["heading", { eyebrow: "Outcome", text: "What you get.", size: "h1", col: "all" }],
      ["cards", { col: "all" }],
    ],
  },
  steps: {
    label: "Process",
    group: "content",
    icon: "steps",
    desc: "Numbered steps in a row.",
    settings: { valign: "top" },
    elements: [
      ["heading", { eyebrow: "Process", text: "How it works.", size: "h1", col: "all" }],
      ["steps", { col: "all", layout: "row" }],
    ],
  },
  table: {
    label: "Table",
    group: "content",
    icon: "table",
    desc: "A comparison or a price list in rows and columns.",
    settings: { valign: "top" },
    elements: [
      ["heading", { eyebrow: "Comparison", text: "The options side by side.", size: "h1", col: "all" }],
      ["table", { col: "all" }],
    ],
  },
  code: {
    label: "Code or prompt",
    group: "content",
    icon: "code",
    desc: "A snippet, a prompt or a workflow in mono type.",
    settings: { valign: "top" },
    elements: [
      ["heading", { eyebrow: "Example", text: "The prompt that does the work.", size: "h2", col: "all" }],
      ["code", { col: "all", size: "lg" }],
    ],
  },
  person: {
    label: "Presenter",
    group: "proof",
    icon: "bio",
    desc: "Who is speaking: portrait, role and credentials.",
    settings: { layout: "split", valign: "center" },
    elements: [
      ["heading", { eyebrow: "Your presenter", text: "Who is speaking.", size: "h1", col: "1" }],
      ["person", { col: "2" }],
    ],
  },
  logos: {
    label: "Logos",
    group: "proof",
    icon: "logos",
    desc: "Clients, tools or places where the work was seen.",
    settings: { valign: "center" },
    elements: [
      ["heading", { eyebrow: "Trusted by", text: "Teams that run on systems.", size: "h1", col: "all" }],
      ["logos", { col: "all", label: "" }],
    ],
  },
  form: {
    label: "Form",
    group: "action",
    icon: "form",
    desc: "A registration or feedback form from your Forms.",
    settings: { valign: "center" },
    elements: [
      ["heading", { eyebrow: "Stay in touch", text: "Where should we send it.", size: "h1", col: "all" }],
      ["form", { col: "all" }],
    ],
  },
  closing: {
    label: "Closing",
    group: "action",
    icon: "closing",
    desc: "Thank you, the next step and how to reach you. One red button.",
    settings: { bg: "inverse", motif: "asterisk", valign: "center" },
    elements: [
      ["heading", { eyebrow: "Next step", text: "Let's work together.", size: "display_lg", col: "all" }],
      ["text", { content: "borilbogoev.com · Dubai, UAE", size: "meta", tone: "muted", col: "all" }],
      ["button", { label: "Book A Call", url: "https://borilbogoev.com/contact", style: "primary", new_tab: 1, col: "all" }],
    ],
  },
  questions: {
    label: "Questions",
    group: "action",
    icon: "questions",
    desc: "A plain slide for the Q and A.",
    settings: { valign: "center" },
    elements: [["heading", { eyebrow: "Q and A", text: "Questions.", size: "display", col: "all" }]],
  },
  blank: {
    label: "Blank",
    group: "frame",
    icon: "blank",
    desc: "An empty slide. Add any elements you like.",
    settings: {},
    elements: [],
  },
};

export const SLIDE_KIND_KEYS = Object.keys(SLIDE_KINDS) as SlideKind[];

export function isSlideKind(t: unknown): t is SlideKind {
  return typeof t === "string" && Object.prototype.hasOwnProperty.call(SLIDE_KINDS, t);
}

/** A new slide of a kind: layout settings and pre-filled elements, ready to edit. */
export function newSlide(kind: SlideKind): { kind: SlideKind; settings: Settings; elements: { type: ElementType; settings: Settings }[] } {
  const k = SLIDE_KINDS[kind];
  return {
    kind,
    settings: mergeDefaults(slideDefaults(), k.settings),
    elements: k.elements.map(([type, over]) => ({ type, settings: mergeDefaults(elementDefaults(type), over ?? {}) })),
  };
}

/** Saved slide settings laid over the defaults, so new settings appear on old slides. */
export function slideWithDefaults(saved: unknown): Settings {
  return mergeDefaults(slideDefaults(), saved);
}

export type ElementInput = { id?: number; type: string; settings?: unknown };
export type SlideInput = { id?: number; kind?: string; settings?: unknown; elements?: ElementInput[] };

export const MAX_SLIDES = 120;
export const MAX_ELEMENTS = 30;

export function cleanSlideInput(input: SlideInput[]): { kind: SlideKind; settings: Settings; elements: { type: ElementType; settings: Settings }[] }[] {
  const out = [];
  for (const s of input.slice(0, MAX_SLIDES)) {
    const kind = isSlideKind(s.kind) ? s.kind : "blank";
    const elements = [];
    for (const e of (Array.isArray(s.elements) ? s.elements : []).slice(0, MAX_ELEMENTS)) {
      const type = String(e.type ?? "");
      if (isElementType(type)) elements.push({ type, settings: sanitizeElement(type, e.settings) });
    }
    out.push({ kind, settings: sanitizeSlideSettings(s.settings), elements });
  }
  return out;
}

export { elementWithDefaults };

/** The name a slide goes by in the outline and the accordion: its own name, else its first heading, else its kind. */
export function slideTitle(s: Pick<DeckSlide, "kind" | "settings" | "elements">): string {
  const own = String(s.settings.title ?? "").trim();
  if (own) return own;
  const h = s.elements.find((e) => e.type === "heading" && String(e.settings.text ?? "").trim());
  if (h) return String(h.settings.text).replace(/\.$/, "");
  const q = s.elements.find((e) => e.type === "quote");
  if (q) return String(q.settings.quote ?? "").slice(0, 60);
  return SLIDE_KINDS[s.kind]?.label ?? "Slide";
}
