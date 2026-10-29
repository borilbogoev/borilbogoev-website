// Block registry of Landing Pages. Same model as the Forms blocks (one schema drives the builder, the renderer and the validation);
// the content blocks (Title, Text, Image, Divider, Spacer) are the Forms definitions themselves, extended with section controls.
import { BLOCK_TYPES as FORM_BLOCKS, defaultsFor, mergeDefaults, sanitizeFor, type Control, type Settings } from "@/modules/forms/lib/blocks";
import { cleanSlug } from "@/modules/forms/lib/sanitize";

export type { Settings, Control };

export type LandingBlockType =
  | "hero"
  | "hero_image"
  | "cta"
  | "buttons"
  | "form"
  | "quote"
  | "stats"
  | "cards"
  | "features"
  | "gallery"
  | "carousel"
  | "video"
  | "audio"
  | "pricing"
  | "testimonials"
  | "guarantee"
  | "ps"
  | "faq"
  | "steps"
  | "list"
  | "compare"
  | "bonuses"
  | "bio"
  | "logos"
  | "countdown"
  | "session"
  | "embed"
  | "heading"
  | "text"
  | "image"
  | "divider"
  | "spacer";

export type LandingGroup = "hero" | "conversion" | "content" | "media" | "proof" | "offer" | "layout";

export const LANDING_GROUPS: Record<LandingGroup, string> = {
  hero: "Hero",
  conversion: "Conversion",
  content: "Content",
  media: "Media",
  proof: "Social proof",
  offer: "Offer",
  layout: "Layout",
};

export type LandingBlockDef = {
  label: string;
  group: LandingGroup;
  icon: string;
  desc: string;
  /** Where the block was defined: shared with the Forms module, or specific to Landing Pages. */
  shared?: boolean;
  controls: Control[];
};

export type LandingBlock = { id: number; type: LandingBlockType; settings: Settings };

/* -------------------------------------------------------------------------- */
/* Shared pieces                                                              */
/* -------------------------------------------------------------------------- */

export const ICONS: Record<string, string> = {
  check: "Check",
  spark: "Spark",
  workflow: "Workflow",
  chart: "Chart",
  book: "Book",
  users: "People",
  clock: "Clock",
  shield: "Shield",
  star: "Star",
  target: "Target",
  mail: "Mail",
  calendar: "Calendar",
  lock: "Lock",
  bolt: "Bolt",
  globe: "Globe",
  heart: "Heart",
  layers: "Layers",
  search: "Search",
  award: "Award",
};

const image = (key: string, label: string): Control => ({ key, type: "image", label, default: { id: 0, url: "" } });
const text = (key: string, label: string, def = "", help?: string): Control => ({ key, type: "text", label, default: def, help });
const area = (key: string, label: string, def = "", help?: string): Control => ({ key, type: "textarea", label, default: def, help });
const md = (key: string, label: string, def = ""): Control => ({ key, type: "markdown", label, default: def });
const url = (key: string, label: string, def = ""): Control => ({ key, type: "url", label, default: def });
const toggle = (key: string, label: string, def = 0): Control => ({ key, type: "toggle", label, default: def });
const select = (key: string, label: string, def: string, choices: Record<string, string>): Control => ({ key, type: "select", label, default: def, choices });
const items = (key: string, label: string, fields: Control[], def: Settings[], item_label: string, max = 12, help?: string): Control => ({ key, type: "items", label, fields, default: def, item_label, max, help });

/** Eyebrow, heading and intro that open most sections. */
const head = (eyebrow = "", heading = "", intro = ""): Control[] => [text("eyebrow", "Eyebrow (small red label)", eyebrow), text("heading", "Heading", heading), text("intro", "Intro (one sentence)", intro)];

/** Look controls every section has. */
const section = (bg: "surface" | "alt" | "inverse" = "surface"): Control[] => [
  select("bg", "Background", bg, { surface: "White", alt: "Light grey", inverse: "Dark band" }),
  select("spacing", "Spacing", "normal", { none: "None", tight: "Tight", normal: "Normal", loose: "Loose" }),
  text("anchor", "Anchor (for #links)", "", "Letters, numbers and dashes. Link to this section with #name."),
  select("hide", "Show on", "", { "": "All screens", mobile: "Phones only", desktop: "Desktop only" }),
];

const buttonFields: Control[] = [
  text("label", "Label", "Learn More"),
  url("url", "Link", "#form"),
  select("style", "Style", "primary", { primary: "Primary (red)", dark: "Dark (black)", outline: "Outline", inverse: "Outline on dark", tint: "Soft red", link: "Text link" }),
  select("size", "Size", "md", { md: "Normal", lg: "Large" }),
  select("icon", "Icon", "none", { none: "None", arrow: "Arrow", download: "Download", calendar: "Calendar", play: "Play", external: "External" }),
  toggle("new_tab", "Open in a new tab"),
];

const imageSide = select("image_side", "Image position", "right", { right: "Right of the text", left: "Left of the text" });

/** A content block of the Forms module, reused here: same fields, no form logic, plus the section controls. */
function shared(key: "heading" | "text" | "image" | "session" | "divider" | "spacer", group: LandingGroup, desc: string, extra: Control[]): LandingBlockDef {
  const def = FORM_BLOCKS[key];
  return {
    label: def.label,
    group,
    icon: def.icon,
    desc,
    shared: true,
    controls: [...def.controls.filter((c) => c.type !== "logic"), ...extra],
  };
}

/* -------------------------------------------------------------------------- */
/* The blocks                                                                 */
/* -------------------------------------------------------------------------- */

export const LANDING_BLOCKS: Record<LandingBlockType, LandingBlockDef> = {
  hero: {
    label: "Hero",
    group: "hero",
    icon: "hero",
    desc: "The opening statement: headline, one line of support and the main action. No image.",
    controls: [
      text("badge", "Badge (optional)", ""),
      text("eyebrow", "Eyebrow (small red label)", "Free Webinar"),
      text("headline", "Headline", "A clear promise in one sentence"),
      toggle("accent_dot", "Red full stop after the headline", 1),
      text("subtitle", "Subtitle (light line)", "Who it is for and the result they get."),
      md("text", "Text (Markdown)", ""),
      { key: "bullets", type: "options", label: "Key points", default: [] },
      text("cta_label", "Button label", "Reserve My Seat"),
      url("cta_url", "Button link", "#form"),
      text("secondary_label", "Second button label (optional)", ""),
      url("secondary_url", "Second button link", ""),
      text("note", "Small print under the buttons", ""),
      items("facts", "Facts row", [text("label", "Label", "Format"), text("value", "Value", "Live online")], [], "label", 4),
      select("style", "Style", "soft", { soft: "Soft grey band", plain: "White", inverse: "Dark" }),
      select("align", "Alignment", "left", { left: "Left", center: "Centered" }),
      select("spacing", "Spacing", "normal", { tight: "Tight", normal: "Normal", loose: "Loose" }),
      text("anchor", "Anchor (for #links)", ""),
    ],
  },
  hero_image: {
    label: "Hero with image",
    group: "hero",
    icon: "heroimg",
    desc: "Headline and action next to a picture, a portrait or a product shot.",
    controls: [
      text("badge", "Badge (optional)", ""),
      text("eyebrow", "Eyebrow (small red label)", "Free Webinar"),
      text("headline", "Headline", "A clear promise in one sentence"),
      toggle("accent_dot", "Red full stop after the headline", 1),
      text("subtitle", "Subtitle (light line)", "Who it is for and the result they get."),
      md("text", "Text (Markdown)", ""),
      { key: "bullets", type: "options", label: "Key points", default: [] },
      text("cta_label", "Button label", "Reserve My Seat"),
      url("cta_url", "Button link", "#form"),
      text("secondary_label", "Second button label (optional)", ""),
      url("secondary_url", "Second button link", ""),
      text("note", "Small print under the buttons", ""),
      image("image", "Image"),
      text("image_alt", "Image description (alt text)", ""),
      imageSide,
      select("image_style", "Image style", "rounded", { rounded: "Rounded corners", portrait: "Circle with dashed ring", plain: "Plain" }),
      text("image_caption", "Image caption", ""),
      select("style", "Style", "soft", { soft: "Soft grey band", plain: "White", inverse: "Dark" }),
      select("spacing", "Spacing", "normal", { tight: "Tight", normal: "Normal", loose: "Loose" }),
      text("anchor", "Anchor (for #links)", ""),
    ],
  },
  cta: {
    label: "Call to action",
    group: "conversion",
    icon: "cta",
    desc: "A closing push. Short is one line and a button; long adds a heading, text and key points.",
    controls: [
      select("length", "Length", "long", { short: "Short: one line and a button", long: "Long: heading, text and key points" }),
      text("eyebrow", "Eyebrow (small red label)", "Next Step"),
      text("heading", "Heading", "Ready to start."),
      text("text", "Text", "One or two sentences that remove the last doubt."),
      { key: "bullets", type: "options", label: "Key points (long only)", default: [] },
      text("cta_label", "Button label", "Reserve My Seat"),
      url("cta_url", "Button link", "#form"),
      text("secondary_label", "Second button label (optional)", ""),
      url("secondary_url", "Second button link", ""),
      text("note", "Small print under the buttons", ""),
      select("align", "Alignment", "left", { left: "Left", center: "Centered" }),
      ...section("inverse"),
    ],
  },
  buttons: {
    label: "Buttons",
    group: "conversion",
    icon: "buttons",
    desc: "A row of buttons in different styles: primary, dark, outline, soft red or a text link.",
    controls: [
      items("items", "Buttons", buttonFields, [{ label: "Learn More", url: "#form", style: "primary", size: "md", icon: "none", new_tab: 0 }], "label", 8),
      select("align", "Alignment", "left", { left: "Left", center: "Centered", right: "Right" }),
      select("layout", "Layout", "row", { row: "In a row", stack: "Stacked, full width" }),
      ...section("surface"),
    ],
  },
  form: {
    label: "Form",
    group: "conversion",
    icon: "form",
    desc: "One of your Forms: registration, lead capture, inquiry. Inline, or a button that opens it in a dialog.",
    controls: [
      { key: "form_id", type: "form", label: "Form", default: 0 },
      select("display", "Display", "inline", { inline: "Inline, in the page", modal: "A button opens a dialog" }),
      text("button_label", "Button label (dialog)", "Register Now"),
      ...head("Registration", "Reserve your seat.", ""),
      select("width", "Width", "narrow", { narrow: "Narrow (form width)", wide: "Wide" }),
      select("theme", "Form theme", "light", { light: "Light", dark: "Dark" }),
      ...section("alt").map((c) => (c.key === "anchor" ? { ...c, default: "form" } : c)),
    ],
  },
  quote: {
    label: "Quote",
    group: "proof",
    icon: "quote",
    desc: "A reinforcement statement or a pulled quote. The dark statement style is the page's full stop.",
    controls: [
      area("quote", "Quote or statement", "One sentence that makes the idea stick."),
      text("author", "Who said it", ""),
      text("role", "Role or source", ""),
      image("image", "Photo (optional)"),
      select("style", "Style", "statement", { statement: "Large statement", card: "Card" }),
      select("align", "Alignment", "left", { left: "Left", center: "Centered" }),
      ...section("inverse"),
    ],
  },
  stats: {
    label: "Numbers",
    group: "proof",
    icon: "numbers",
    desc: "Big figures with a red suffix. Use honest, approximate numbers with a tilde.",
    controls: [
      ...head("Results", "The numbers.", ""),
      items(
        "items",
        "Figures",
        [text("prefix", "Prefix", ""), text("value", "Number", "40"), text("suffix", "Suffix", "%"), text("label", "Label", "Less manual work"), text("note", "Small note", "")],
        [
          { prefix: "~", value: "40", suffix: "%", label: "Reduction in manual workload", note: "" },
          { prefix: "", value: "20", suffix: "+", label: "Years of experience", note: "" },
          { prefix: "", value: "3", suffix: "x", label: "Faster reporting", note: "" },
        ],
        "label",
        6,
      ),
      select("style", "Style", "band", { band: "Row with dividers", cards: "Cards" }),
      ...section("inverse"),
    ],
  },
  cards: {
    label: "Grid of blocks",
    group: "content",
    icon: "grid",
    desc: "Cards in a grid, each with an image, title, text and link.",
    controls: [
      ...head("Programs", "What is inside.", ""),
      items(
        "items",
        "Cards",
        [image("image", "Image"), text("image_alt", "Image description (alt text)", ""), text("title", "Title", "Card title"), area("text", "Text", "Two short sentences."), text("link_label", "Link label", ""), url("link_url", "Link", "")],
        [
          { image: { id: 0, url: "" }, image_alt: "", title: "First", text: "Two short sentences.", link_label: "", link_url: "" },
          { image: { id: 0, url: "" }, image_alt: "", title: "Second", text: "Two short sentences.", link_label: "", link_url: "" },
          { image: { id: 0, url: "" }, image_alt: "", title: "Third", text: "Two short sentences.", link_label: "", link_url: "" },
        ],
        "title",
        12,
      ),
      select("columns", "Columns", "3", { "2": "2", "3": "3", "4": "4" }),
      select("ratio", "Image shape", "16:9", { "16:9": "Wide 16:9", "4:3": "Classic 4:3", "1:1": "Square", none: "No image" }),
      ...section("surface"),
    ],
  },
  features: {
    label: "Benefits",
    group: "content",
    icon: "features",
    desc: "Short benefits with an outline icon: what the visitor gets.",
    controls: [
      ...head("Outcome", "What you get.", ""),
      items(
        "items",
        "Benefits",
        [select("icon", "Icon", "check", ICONS), text("title", "Title", "Benefit"), area("text", "Text", "One sentence.")],
        [
          { icon: "spark", title: "First benefit", text: "One sentence." },
          { icon: "workflow", title: "Second benefit", text: "One sentence." },
          { icon: "chart", title: "Third benefit", text: "One sentence." },
        ],
        "title",
        12,
      ),
      select("columns", "Columns", "3", { "2": "2", "3": "3", "4": "4" }),
      select("style", "Style", "cards", { cards: "Cards", plain: "Plain" }),
      ...section("surface"),
    ],
  },
  gallery: {
    label: "Gallery",
    group: "media",
    icon: "gallery",
    desc: "A grid of images with optional captions.",
    controls: [
      ...head("", "", ""),
      items("items", "Images", [image("image", "Image"), text("alt", "Image description (alt text)", ""), text("caption", "Caption", "")], [], "caption", 24),
      select("columns", "Columns", "3", { "2": "2", "3": "3", "4": "4" }),
      select("ratio", "Shape", "4:3", { original: "Original", "1:1": "Square", "4:3": "Classic 4:3", "16:9": "Wide 16:9" }),
      ...section("surface"),
    ],
  },
  carousel: {
    label: "Carousel",
    group: "media",
    icon: "carousel",
    desc: "A slide show you can swipe: images with a title, text and link.",
    controls: [
      ...head("", "", ""),
      items("items", "Slides", [image("image", "Image"), text("alt", "Image description (alt text)", ""), text("title", "Title", ""), area("text", "Text", ""), text("link_label", "Link label", ""), url("link_url", "Link", "")], [], "title", 16),
      select("per_view", "Slides in view (desktop)", "1", { "1": "1", "2": "2", "3": "3" }),
      { key: "autoplay", type: "number", label: "Auto-advance every (seconds, 0 = off)", default: 0, min: 0, max: 30 },
      select("ratio", "Image shape", "16:9", { "16:9": "Wide 16:9", "4:3": "Classic 4:3", "1:1": "Square" }),
      ...section("surface"),
    ],
  },
  video: {
    label: "Video",
    group: "media",
    icon: "video",
    desc: "YouTube, Vimeo, Loom or an MP4. Loads on click, so the page stays fast.",
    controls: [
      ...head("", "", ""),
      url("url", "Video link", ""),
      text("title", "Video title (for screen readers)", "Video"),
      image("poster", "Cover image (recommended)"),
      select("ratio", "Shape", "16:9", { "16:9": "Wide 16:9", "4:3": "Classic 4:3", "1:1": "Square", "9:16": "Vertical 9:16" }),
      text("caption", "Caption", ""),
      select("width", "Width", "wide", { narrow: "Narrow", wide: "Wide" }),
      ...section("surface"),
    ],
  },
  audio: {
    label: "Audio",
    group: "media",
    icon: "audio",
    desc: "An audio player for an MP3 or a Spotify link, with an optional transcript.",
    controls: [
      ...head("", "", ""),
      url("url", "Audio file (.mp3, .m4a) or Spotify link", ""),
      text("title", "Title", "Listen"),
      area("description", "Description", ""),
      image("artwork", "Cover image (optional)"),
      md("transcript", "Transcript (Markdown, optional)", ""),
      ...section("surface"),
    ],
  },
  pricing: {
    label: "Pricing table",
    group: "offer",
    icon: "pricing",
    desc: "Up to four plans side by side. Highlight one.",
    controls: [
      ...head("Pricing", "Choose your plan.", ""),
      items(
        "items",
        "Plans",
        [
          text("name", "Plan name", "Plan"),
          text("price", "Price", "$0"),
          text("period", "Period or note", "one-time"),
          text("badge", "Badge (optional)", ""),
          area("description", "Description", ""),
          area("features", "Included (one per line)", "First thing included\nSecond thing included"),
          text("button_label", "Button label", "Choose Plan"),
          url("button_url", "Button link", "#form"),
          toggle("highlight", "Highlight this plan"),
        ],
        [
          { name: "Starter", price: "$0", period: "", badge: "", description: "", features: "First thing included\nSecond thing included", button_label: "Choose Plan", button_url: "#form", highlight: 0 },
          { name: "Standard", price: "$0", period: "", badge: "Most chosen", description: "", features: "Everything in Starter\nThird thing included", button_label: "Choose Plan", button_url: "#form", highlight: 1 },
        ],
        "name",
        4,
      ),
      text("footnote", "Footnote", ""),
      ...section("alt"),
    ],
  },
  testimonials: {
    label: "Testimonials",
    group: "proof",
    icon: "testimonial",
    desc: "What clients say, with name, role and a result.",
    controls: [
      ...head("Clients", "What they say.", ""),
      items(
        "items",
        "Testimonials",
        [area("quote", "Quote", "A specific, honest sentence about the result."), text("name", "Name", "Name Surname"), text("role", "Role and company", "Role, Company"), image("image", "Photo (optional)"), text("result", "Result (optional)", "")],
        [{ quote: "A specific, honest sentence about the result.", name: "Name Surname", role: "Role, Company", image: { id: 0, url: "" }, result: "" }],
        "name",
        12,
      ),
      select("layout", "Layout", "grid", { grid: "Cards in a grid", featured: "One large quote", list: "List" }),
      ...section("surface"),
    ],
  },
  guarantee: {
    label: "Guarantee",
    group: "offer",
    icon: "shield",
    desc: "Remove the risk: what you promise and how the visitor gets a refund or a redo.",
    controls: [
      text("eyebrow", "Eyebrow (small red label)", "Guarantee"),
      text("heading", "Heading", "You risk nothing."),
      text("badge", "Badge text", "30 days"),
      md("text", "Text (Markdown)", "Say exactly what you promise and how to claim it."),
      { key: "points", type: "options", label: "Conditions or points", default: [] },
      ...section("alt"),
    ],
  },
  ps: {
    label: "P.S.",
    group: "offer",
    icon: "ps",
    desc: "The postscript: the last, most read line of a sales page.",
    controls: [
      text("label", "Label", "P.S."),
      md("text", "Text (Markdown)", "Restate the one reason to act now."),
      text("cta_label", "Button label (optional)", ""),
      url("cta_url", "Button link", "#form"),
      ...section("surface"),
    ],
  },
  faq: {
    label: "FAQ",
    group: "offer",
    icon: "faq",
    desc: "Questions and answers. Marked up for search engines.",
    controls: [
      ...head("FAQ", "Questions.", ""),
      items("items", "Questions", [text("q", "Question", "Question"), md("a", "Answer (Markdown)", "Answer.")], [{ q: "Question", a: "Answer." }], "q", 24),
      ...section("alt"),
    ],
  },
  steps: {
    label: "Steps",
    group: "content",
    icon: "steps",
    desc: "How it works, in numbered steps.",
    controls: [
      ...head("Process", "How it works.", ""),
      items(
        "items",
        "Steps",
        [text("title", "Title", "Step"), area("text", "Text", "")],
        [
          { title: "First step", text: "What happens." },
          { title: "Second step", text: "What happens." },
          { title: "Third step", text: "What happens." },
        ],
        "title",
        8,
      ),
      select("layout", "Layout", "cards", { cards: "Cards", list: "Vertical list" }),
      ...section("surface"),
    ],
  },
  list: {
    label: "Checklist",
    group: "content",
    icon: "list",
    desc: "A list of points with check marks, dots or crosses. For what is included, who it is for, who it is not for.",
    controls: [
      ...head("Included", "What is inside.", ""),
      { key: "items", type: "options", label: "Points", default: ["First point", "Second point", "Third point"] },
      select("mark", "Marker", "check", { check: "Check mark", dot: "Red dot", cross: "Minus" }),
      select("columns", "Columns", "2", { "1": "1", "2": "2" }),
      ...section("surface"),
    ],
  },
  compare: {
    label: "Before and after",
    group: "content",
    icon: "compare",
    desc: "Two columns: without and with, old way and new way.",
    controls: [
      ...head("Difference", "Before and after.", ""),
      text("left_title", "Left title", "Without a system"),
      { key: "left_items", type: "options", label: "Left points", default: ["Manual work", "Scattered tools"] },
      text("right_title", "Right title", "With a system"),
      { key: "right_items", type: "options", label: "Right points", default: ["Automated work", "One operating system"] },
      ...section("surface"),
    ],
  },
  bonuses: {
    label: "Bonuses",
    group: "offer",
    icon: "gift",
    desc: "What else is included, with the value of each.",
    controls: [
      ...head("Bonuses", "Included with it.", ""),
      items("items", "Bonuses", [text("title", "Title", "Bonus"), area("text", "Text", ""), text("value", "Value", "")], [{ title: "First bonus", text: "", value: "" }], "title", 8),
      text("total", "Total line", ""),
      ...section("alt"),
    ],
  },
  bio: {
    label: "About the presenter",
    group: "proof",
    icon: "bio",
    desc: "Who is behind it: portrait, role, short story and credentials.",
    controls: [
      text("eyebrow", "Eyebrow (small red label)", "Your Host"),
      text("name", "Name", "Boril Bogoev, Ph.D."),
      text("role", "Role line", "Head of AI and Automation"),
      md("text", "Text (Markdown)", "Two short paragraphs. Facts first."),
      { key: "credentials", type: "options", label: "Credentials", default: [] },
      image("image", "Portrait"),
      text("image_alt", "Image description (alt text)", ""),
      text("link_label", "Link label", ""),
      url("link_url", "Link", ""),
      imageSide,
      ...section("surface"),
    ],
  },
  logos: {
    label: "Logos",
    group: "proof",
    icon: "logos",
    desc: "Trusted by, seen in, tools used. Images in grey, or plain names.",
    controls: [
      text("label", "Label above the row", "Trusted by"),
      items("items", "Names", [text("name", "Name", "Name"), image("image", "Logo (optional)"), url("url", "Link (optional)", "")], [], "name", 16),
      ...section("surface"),
    ],
  },
  countdown: {
    label: "Countdown",
    group: "conversion",
    icon: "timer",
    desc: "A real deadline only: the start of an event, the end of an offer.",
    controls: [
      text("label", "Label", "The webinar starts in"),
      text("target", "Date and time", "", "ISO format with the time zone, e.g. 2026-11-05T18:00:00+04:00 (Dubai)."),
      text("done_text", "Text after the date", "The event has started."),
      ...section("surface"),
    ],
  },
  session: shared("session", "conversion", "A dated live event: a dark card with the date, time, details and a sign-up button.", section("surface")),
  embed: {
    label: "Embed",
    group: "media",
    icon: "embed",
    desc: "A booking calendar or an external form (Calendly, Cal.com, Tally, Typeform).",
    controls: [
      ...head("", "", ""),
      url("url", "Embed link", ""),
      text("title", "Title (for screen readers)", "Embedded content"),
      { key: "height", type: "number", label: "Height (px)", default: 700, min: 200, max: 1600 },
      ...section("surface"),
    ],
  },
  heading: shared("heading", "content", "A title with an optional eyebrow and red full stop.", section("surface")),
  text: shared("text", "content", "Rich text in Markdown: paragraphs, lists, links.", section("surface")),
  image: shared("image", "media", "A single image with caption and optional link.", section("surface")),
  divider: shared("divider", "layout", "A line, dots or the short red bar.", []),
  spacer: shared("spacer", "layout", "Empty vertical space.", []),
};

export const LANDING_BLOCK_KEYS = Object.keys(LANDING_BLOCKS) as LandingBlockType[];

export function isLandingBlockType(t: unknown): t is LandingBlockType {
  return typeof t === "string" && Object.prototype.hasOwnProperty.call(LANDING_BLOCKS, t);
}

export function landingDefaults(type: LandingBlockType): Settings {
  return defaultsFor(LANDING_BLOCKS[type].controls);
}

export function landingWithDefaults(type: LandingBlockType, saved: unknown): Settings {
  return mergeDefaults(landingDefaults(type), saved);
}

/** Sanitize settings against the block's schema. Anchors are reduced to id-safe slugs. */
export function sanitizeLandingBlock(type: LandingBlockType, input: unknown): Settings {
  const out = sanitizeFor(LANDING_BLOCKS[type].controls, input);
  if (typeof out.anchor === "string") out.anchor = cleanSlug(out.anchor).slice(0, 40);
  if (type === "countdown") {
    const t = String(out.target ?? "");
    out.target = t && !Number.isNaN(Date.parse(t)) ? t : "";
  }
  return out;
}

/** Hosts an Embed block may load. Everything else is refused, so a page cannot pull in arbitrary third-party code. */
export const EMBED_HOSTS = ["calendly.com", "cal.com", "tally.so", "typeform.com", "forms.gle", "docs.google.com", "airtable.com", "youcanbook.me", "savvycal.com"];

export function embedAllowed(href: string): boolean {
  try {
    const u = new URL(href);
    if (u.protocol !== "https:") return false;
    return EMBED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}
