// Elements: the building blocks inside a slide. Same model as the Forms and Landing blocks: one list of controls per type
// drives the builder inspector, the defaults and the validation. Divider and Spacer are the Forms definitions, reused.
import { BLOCK_TYPES as FORM_BLOCKS, defaultsFor, mergeDefaults, sanitizeFor, type Control, type Settings } from "@/modules/forms/lib/blocks";
import { ICONS } from "@/modules/landing/lib/blocks";

export type { Control, Settings };

export type ElementType =
  | "heading"
  | "text"
  | "bullets"
  | "image"
  | "gallery"
  | "video"
  | "embed"
  | "quote"
  | "stats"
  | "steps"
  | "cards"
  | "compare"
  | "code"
  | "table"
  | "logos"
  | "person"
  | "button"
  | "form"
  | "divider"
  | "spacer";

export type ElementGroup = "text" | "media" | "data" | "action" | "layout";

export const ELEMENT_GROUPS: Record<ElementGroup, string> = {
  text: "Text",
  media: "Media",
  data: "Structure",
  action: "Action",
  layout: "Layout",
};

export type ElementDef = { label: string; group: ElementGroup; icon: string; desc: string; shared?: boolean; controls: Control[] };
export type DeckElement = { id: number; type: ElementType; settings: Settings };

const image = (key: string, label: string): Control => ({ key, type: "image", label, default: { id: 0, url: "" } });
const text = (key: string, label: string, def = "", help?: string): Control => ({ key, type: "text", label, default: def, help });
const area = (key: string, label: string, def = "", help?: string): Control => ({ key, type: "textarea", label, default: def, help });
const md = (key: string, label: string, def = ""): Control => ({ key, type: "markdown", label, default: def });
const url = (key: string, label: string, def = "", help?: string): Control => ({ key, type: "url", label, default: def, help });
const toggle = (key: string, label: string, def = 0, help?: string): Control => ({ key, type: "toggle", label, default: def, help });
const select = (key: string, label: string, def: string, choices: Record<string, string>): Control => ({ key, type: "select", label, default: def, choices });
const items = (key: string, label: string, fields: Control[], def: Settings[], item_label: string, max = 12): Control => ({ key, type: "items", label, fields, default: def, item_label, max });

/** Where an element sits and how it appears. Shown under "Placement" in the inspector. */
export const PLACEMENT_KEYS = new Set(["col", "build", "align"]);
const placement = (col = "1"): Control[] => [
  select("col", "Column (two-column slides)", col, { all: "Full width, on top", "1": "Left column", "2": "Right column" }),
  select("build", "Appears", "", { "": "With the slide", click: "On the next click" }),
  select("align", "Alignment", "", { "": "Same as the slide", left: "Left", center: "Centered" }),
];

const ratioChoices = { "16:9": "Wide 16:9", "4:3": "Classic 4:3", "1:1": "Square", "9:16": "Vertical 9:16" };

/** A content block of the Forms module, reused: same fields, no form logic. */
function shared(key: "divider" | "spacer", desc: string): ElementDef {
  const def = FORM_BLOCKS[key];
  return { label: def.label, group: "layout", icon: def.icon, desc, shared: true, controls: [...def.controls.filter((c) => c.type !== "logic"), ...placement("all").filter((c) => c.key !== "align")] };
}

export const ELEMENTS: Record<ElementType, ElementDef> = {
  heading: {
    label: "Heading",
    group: "text",
    icon: "heading",
    desc: "Eyebrow, heading and a light line under it. The first thing the room reads.",
    controls: [
      text("eyebrow", "Eyebrow (small red label)", ""),
      text("text", "Heading", "A clear heading in sentence case."),
      toggle("accent_dot", "Red full stop after the heading", 1),
      text("subtitle", "Subtitle (light line)", ""),
      select("size", "Size", "h1", { display: "Display: cover title", display_lg: "Display large: statement", h1: "Heading", h2: "Subheading" }),
      ...placement("all"),
    ],
  },
  text: {
    label: "Text",
    group: "text",
    icon: "text",
    desc: "A short paragraph in Markdown. Keep it to two or three lines.",
    controls: [
      md("content", "Text (Markdown)", "One short paragraph. **Key phrases** in bold."),
      select("size", "Size", "md", { lg: "Large", md: "Normal", sm: "Small", meta: "Caption in mono" }),
      select("tone", "Colour", "muted", { muted: "Grey (body copy)", ink: "Black" }),
      ...placement("1"),
    ],
  },
  bullets: {
    label: "Bullet list",
    group: "text",
    icon: "list",
    desc: "Points with red dots, numbers or check marks. Can appear one by one.",
    controls: [
      { key: "items", type: "options", label: "Points", default: ["First point", "Second point", "Third point"] },
      select("marker", "Marker", "dot", { dot: "Red dot", number: "Numbers", check: "Check mark", none: "None" }),
      select("size", "Size", "md", { lg: "Large", md: "Normal" }),
      select("columns", "Columns", "1", { "1": "1", "2": "2" }),
      toggle("build_items", "Show one point at a time, on each click", 0),
      ...placement("1"),
    ],
  },
  image: {
    label: "Image",
    group: "media",
    icon: "image",
    desc: "A picture. Fit shows all of it, Fill crops it to the space.",
    controls: [
      image("image", "Image"),
      text("alt", "Image description (alt text)", ""),
      text("caption", "Caption", ""),
      select("fit", "Fit", "contain", { contain: "Fit: show the whole picture", cover: "Fill: crop to the space" }),
      select("shape", "Shape", "rounded", { rounded: "Rounded corners", plain: "Plain", circle: "Circle with dashed ring" }),
      toggle("mono", "Greyscale", 0, "The brand shows photography in greyscale. Leave off for screenshots and diagrams."),
      ...placement("2"),
    ],
  },
  gallery: {
    label: "Image grid",
    group: "media",
    icon: "gallery",
    desc: "Two to four pictures side by side, with captions.",
    controls: [
      items("items", "Images", [image("image", "Image"), text("alt", "Image description (alt text)", ""), text("caption", "Caption", "")], [], "caption", 8),
      select("columns", "Columns", "3", { "2": "2", "3": "3", "4": "4" }),
      toggle("mono", "Greyscale", 0),
      ...placement("all"),
    ],
  },
  video: {
    label: "Video",
    group: "media",
    icon: "video",
    desc: "YouTube, Vimeo, Loom or an MP4. Loads on click, so the deck stays fast.",
    controls: [
      url("url", "Video link", ""),
      text("title", "Video title (for screen readers)", "Video"),
      image("poster", "Cover image (recommended)"),
      select("ratio", "Shape", "16:9", ratioChoices),
      text("caption", "Caption", ""),
      ...placement("all"),
    ],
  },
  embed: {
    label: "Interactive embed",
    group: "media",
    icon: "embed",
    desc: "A live page inside the slide: a prototype, a board, a demo, a calendar. Opens when the slide is reached.",
    controls: [
      url("url", "Page address", "", "An https:// address, or a path of this site such as /demo. Allowed: this site, Figma, Miro, Canva, Google Docs, Calendly, Tally, Typeform, Loom, CodePen, CodeSandbox, StackBlitz, Excalidraw, Vercel apps."),
      text("title", "Title (for screen readers)", "Interactive demo"),
      select("mode", "Height", "fill", { fill: "Fill the slide", fixed: "Fixed height" }),
      { key: "height", type: "number", label: "Fixed height (px)", default: 560, min: 200, max: 1600 },
      toggle("open_link", "Show an “Open in a new tab” link", 1, "Some sites refuse to be shown inside another page. The link is the way out."),
      ...placement("all"),
    ],
  },
  quote: {
    label: "Quote",
    group: "text",
    icon: "quote",
    desc: "A pulled quote or a client sentence, with the source.",
    controls: [
      area("quote", "Quote", "One sentence that makes the idea stick."),
      text("author", "Who said it", ""),
      text("role", "Role or source", ""),
      select("size", "Size", "lg", { md: "Normal", lg: "Large", xl: "Extra large" }),
      ...placement("all"),
    ],
  },
  stats: {
    label: "Numbers",
    group: "data",
    icon: "numbers",
    desc: "Big figures with a red suffix. Honest, approximate numbers with a tilde.",
    controls: [
      items(
        "items",
        "Figures",
        [text("prefix", "Prefix", ""), text("value", "Number", "40"), text("suffix", "Suffix", "%"), text("label", "Label", "Less manual work")],
        [
          { prefix: "~", value: "40", suffix: "%", label: "Reduction in manual workload" },
          { prefix: "", value: "20", suffix: "+", label: "Years of experience" },
          { prefix: "", value: "3", suffix: "x", label: "Faster reporting" },
        ],
        "label",
        6,
      ),
      ...placement("all"),
    ],
  },
  steps: {
    label: "Steps",
    group: "data",
    icon: "steps",
    desc: "A process or an agenda. Numbered cards in a row, or a list of rows.",
    controls: [
      items(
        "items",
        "Steps",
        [text("title", "Title", "Step"), text("text", "Text", ""), text("meta", "Small note (time, owner)", "")],
        [
          { title: "First step", text: "What happens.", meta: "" },
          { title: "Second step", text: "What happens.", meta: "" },
          { title: "Third step", text: "What happens.", meta: "" },
        ],
        "title",
        8,
      ),
      select("layout", "Layout", "row", { row: "Cards in a row", list: "List of rows (agenda)" }),
      toggle("build_items", "Show one step at a time, on each click", 0),
      ...placement("all"),
    ],
  },
  cards: {
    label: "Cards",
    group: "data",
    icon: "features",
    desc: "Short benefits or ideas, each with an outline icon.",
    controls: [
      items(
        "items",
        "Cards",
        [{ key: "icon", type: "select", label: "Icon", default: "check", choices: ICONS }, text("title", "Title", "Card title"), text("text", "Text", "One sentence.")],
        [
          { icon: "spark", title: "First idea", text: "One sentence." },
          { icon: "workflow", title: "Second idea", text: "One sentence." },
          { icon: "chart", title: "Third idea", text: "One sentence." },
        ],
        "title",
        8,
      ),
      select("columns", "Columns", "3", { "2": "2", "3": "3", "4": "4" }),
      toggle("build_items", "Show one card at a time, on each click", 0),
      ...placement("all"),
    ],
  },
  compare: {
    label: "Before and after",
    group: "data",
    icon: "compare",
    desc: "Two columns: without and with, old way and new way.",
    controls: [
      text("left_title", "Left title", "Without a system"),
      { key: "left_items", type: "options", label: "Left points", default: ["Manual work", "Scattered tools"] },
      text("right_title", "Right title", "With a system"),
      { key: "right_items", type: "options", label: "Right points", default: ["Automated work", "One operating system"] },
      ...placement("all"),
    ],
  },
  code: {
    label: "Code",
    group: "data",
    icon: "code",
    desc: "A snippet, a prompt or a workflow in a mono block.",
    controls: [
      area("code", "Code or prompt", "Write the snippet here."),
      text("label", "Label (file or tool name)", ""),
      select("size", "Size", "md", { sm: "Small", md: "Normal", lg: "Large" }),
      ...placement("all"),
    ],
  },
  table: {
    label: "Table",
    group: "data",
    icon: "table",
    desc: "Rows and columns. One row per line, cells separated by a vertical bar.",
    controls: [
      area("rows", "Rows", "Plan | Hours | Price\nSession | 2 | On request\nSprint | 20 | On request", "One row per line. Separate cells with |. The first row is the header."),
      toggle("header", "First row is a header", 1),
      select("size", "Size", "md", { sm: "Small", md: "Normal" }),
      ...placement("all"),
    ],
  },
  logos: {
    label: "Logos",
    group: "media",
    icon: "logos",
    desc: "Trusted by, seen in, tools used. Images in grey, or plain names.",
    controls: [
      text("label", "Label above the row", "Trusted by"),
      items("items", "Names", [text("name", "Name", "Name"), image("image", "Logo (optional)")], [], "name", 12),
      ...placement("all"),
    ],
  },
  person: {
    label: "Person",
    group: "media",
    icon: "bio",
    desc: "Presenter or guest: portrait, name, role and a short story.",
    controls: [
      image("image", "Portrait"),
      text("image_alt", "Image description (alt text)", ""),
      text("name", "Name", "Boril Bogoev, Ph.D."),
      text("role", "Role line", "Head of AI and Automation"),
      md("text", "Text (Markdown)", ""),
      { key: "credentials", type: "options", label: "Credentials", default: [] },
      ...placement("2"),
    ],
  },
  button: {
    label: "Button",
    group: "action",
    icon: "buttons",
    desc: "One action: book a call, open a demo, download. One red button per slide.",
    controls: [
      text("label", "Label", "Book A Call"),
      url("url", "Link", ""),
      select("style", "Style", "primary", { primary: "Primary (red)", dark: "Dark (black)", outline: "Outline", link: "Text link" }),
      toggle("new_tab", "Open in a new tab", 1, "Keeps the deck open while the demo runs in another tab."),
      ...placement("all"),
    ],
  },
  form: {
    label: "Form",
    group: "action",
    icon: "form",
    desc: "One of your Forms: registration, lead capture, feedback.",
    controls: [
      { key: "form_id", type: "form", label: "Form", default: 0 },
      select("display", "Display", "inline", { inline: "Inline, in the slide", modal: "A button opens a dialog" }),
      text("button_label", "Button label (dialog)", "Register Now"),
      ...placement("all"),
    ],
  },
  divider: shared("divider", "A line, dots or the short red bar."),
  spacer: shared("spacer", "Empty vertical space."),
};

export const ELEMENT_KEYS = Object.keys(ELEMENTS) as ElementType[];

export function isElementType(t: unknown): t is ElementType {
  return typeof t === "string" && Object.prototype.hasOwnProperty.call(ELEMENTS, t);
}

export function elementDefaults(type: ElementType): Settings {
  return defaultsFor(ELEMENTS[type].controls);
}

export function elementWithDefaults(type: ElementType, saved: unknown): Settings {
  return mergeDefaults(elementDefaults(type), saved);
}

export function sanitizeElement(type: ElementType, input: unknown): Settings {
  return sanitizeFor(ELEMENTS[type].controls, input);
}

/** Hosts an Interactive embed may load. Anything else is refused, so a deck cannot pull in arbitrary third-party code. */
export const EMBED_HOSTS = [
  "calendly.com",
  "cal.com",
  "tally.so",
  "typeform.com",
  "forms.gle",
  "docs.google.com",
  "airtable.com",
  "figma.com",
  "miro.com",
  "canva.com",
  "lucid.app",
  "notion.site",
  "codepen.io",
  "codesandbox.io",
  "stackblitz.com",
  "observablehq.com",
  "excalidraw.com",
  "loom.com",
  "borilbogoev.com",
  "vercel.app",
];

/** A path of this site, or an https address on an allowed host. */
export function embedAllowed(href: string): boolean {
  if (/^\/(?!\/)/.test(href)) return true;
  try {
    const u = new URL(href);
    if (u.protocol !== "https:") return false;
    return EMBED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}
