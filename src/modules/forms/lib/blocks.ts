// Block type registry. One schema drives the builder UI, rendering, validation, response columns and charts.
// Ported from class-bbf-blocks.php of the BB Forms WP plugin.
import { cleanHexColor, cleanKey, cleanLink, cleanMultiline, cleanText, cleanUrl, toBool } from "./sanitize";

/** Block settings are schema-driven JSON: the shape depends on the block type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Settings = Record<string, any>;

export type BlockType =
  | "heading"
  | "text"
  | "image"
  | "session"
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "number"
  | "website"
  | "date"
  | "choice"
  | "dropdown"
  | "yes_no"
  | "rating"
  | "scale"
  | "contact"
  | "consent"
  | "file"
  | "hidden"
  | "divider"
  | "spacer"
  | "page_break";

export type ControlType =
  | "text"
  | "textarea"
  | "markdown"
  | "number"
  | "select"
  | "toggle"
  | "color"
  | "field_key"
  | "options"
  | "image"
  | "contact_fields"
  | "logic"
  | "url" // a link: site path, #anchor, http(s), mailto or tel (Landing Pages)
  | "items" // a repeating group of sub-controls, e.g. the cards of a grid (Landing Pages)
  | "form"; // pick one of the forms of this module (Landing Pages)

export type Control = {
  key: string;
  type: ControlType;
  label: string;
  default?: unknown;
  choices?: Record<string, string>;
  min?: number;
  max?: number;
  show_if?: string;
  help?: string; // small hint under the control
  fields?: Control[]; // items: the controls of one entry
  item_label?: string; // items: key of the sub-control that titles each entry in the builder
};

export type BlockGroup = "content" | "questions" | "choice" | "data" | "layout";

export type BlockTypeDef = {
  label: string;
  group: BlockGroup;
  icon: string;
  input?: boolean; // produces data
  chart?: boolean; // gets a breakdown chart
  numeric?: boolean; // sorts and sums as a number
  unique?: boolean; // one per form
  hidden?: boolean;
  controls: Control[];
};

export type Block = {
  id: number;
  type: BlockType;
  fieldKey: string;
  settings: Settings;
};

export const GROUPS: Record<BlockGroup, string> = {
  content: "Content",
  questions: "Questions",
  choice: "Choices & Ratings",
  data: "Contact & Data",
  layout: "Layout",
};

/** Contact block sub-fields: [label, enabled, required, input type]. */
export const CONTACT_FIELDS: Record<string, [string, number, number, string]> = {
  first_name: ["First name", 1, 1, "text"],
  last_name: ["Last name", 1, 0, "text"],
  email: ["Email", 1, 1, "email"],
  phone: ["Phone", 1, 0, "tel"],
  company: ["Company", 0, 0, "text"],
  job_title: ["Job title", 0, 0, "text"],
  website: ["Website", 0, 0, "url"],
  address: ["Address", 0, 0, "text"],
  city: ["City", 0, 0, "text"],
  zip: ["Postal code", 0, 0, "text"],
  country: ["Country", 0, 0, "text"],
};

const LOGIC_OPS = ["equals", "not_equals", "contains", "not_contains", "empty", "not_empty", "gt", "lt"] as const;
export type LogicOp = (typeof LOGIC_OPS)[number];
export const LOGIC_OP_LABELS: Record<LogicOp, string> = {
  equals: "is",
  not_equals: "is not",
  contains: "contains",
  not_contains: "does not contain",
  empty: "is empty",
  not_empty: "is answered",
  gt: "is greater than",
  lt: "is less than",
};

export type Logic = { enabled: number; field: string; op: LogicOp; value: string };

const align: Control = { key: "align", type: "select", label: "Alignment", default: "left", choices: { left: "Left", center: "Center", right: "Right" } };
const placeholder: Control = { key: "placeholder", type: "text", label: "Placeholder", default: "" };
const logic: Control = { key: "logic", type: "logic", label: "Conditional logic" };
const order: Control = {
  key: "order",
  type: "select",
  label: "Order of answers",
  default: "defined",
  choices: { defined: "As defined", random: "Random (per visitor)", alpha: "Alphabetical A-Z", alpha_desc: "Alphabetical Z-A" },
};
const options: Control = { key: "options", type: "options", label: "Options", default: ["Option A", "Option B", "Option C"] };

/** The controls every question has, with the type specific ones in the middle. */
function q(question: string, extra: Control[] = []): Control[] {
  return [
    { key: "question", type: "text", label: "Question", default: question },
    { key: "description", type: "textarea", label: "Description (Markdown)", default: "" },
    { key: "field_key", type: "field_key", label: "Program name (field key)" },
    { key: "required", type: "toggle", label: "Required", default: 0 },
    ...extra,
    logic,
  ];
}

/** The Session block (a dated live event card), defined once here and reused by Landing Pages, Presentations and School. The card is src/components/session-card.tsx. */
export const SESSION_CONTROLS: Control[] = [
  { key: "eyebrow", type: "text", label: "Eyebrow (small label above)", default: "Next Session" },
  { key: "title", type: "text", label: "Title", default: "Title of the Session" },
  { key: "subtitle", type: "text", label: "Subtitle", default: "" },
  { key: "text", type: "textarea", label: "Text", default: "" },
  { key: "bullets", type: "items", label: "Bullet points", default: [], fields: [{ key: "text", type: "text", label: "Bullet", default: "" }], item_label: "text", max: 6 },
  { key: "date", type: "text", label: "Date", default: "", help: "Year-month-day, e.g. 2026-11-12. Leave empty for a card without the date frame." },
  { key: "time", type: "text", label: "Start time (24 hours)", default: "", help: "e.g. 13:00" },
  { key: "offset", type: "text", label: "UTC offset", default: "+04:00", help: "Dubai is +04:00, Sofia +02:00 (+03:00 in summer), UTC +00:00." },
  { key: "zone", type: "text", label: "Time zone shown on the card", default: "Gulf Standard Time (Dubai)" },
  { key: "button_label", type: "text", label: "Button label", default: "Sign up" },
  { key: "button_url", type: "url", label: "Button link", default: "" },
  { key: "secondary_label", type: "text", label: "Second button label (optional)", default: "" },
  { key: "secondary_url", type: "url", label: "Second button link", default: "" },
  { key: "image", type: "image", label: "Picture (optional)", default: { id: 0, url: "" } },
];

export const BLOCK_TYPES: Record<BlockType, BlockTypeDef> = {
  heading: {
    label: "Title",
    group: "content",
    icon: "heading",
    controls: [
      { key: "eyebrow", type: "text", label: "Eyebrow (small label above)", default: "" },
      { key: "text", type: "text", label: "Title", default: "Your title" },
      { key: "level", type: "select", label: "Size", default: "h2", choices: { h1: "XL (H1)", h2: "Large (H2)", h3: "Medium (H3)", h4: "Small (H4)" } },
      { key: "accent_dot", type: "toggle", label: "Accent dot after title", default: 0 },
      align,
      logic,
    ],
  },
  text: {
    label: "Text",
    group: "content",
    icon: "text",
    controls: [
      { key: "content", type: "markdown", label: "Text (Markdown)", default: "Write **rich** text with *Markdown*.\n\n- Lists\n- [Links](https://www.borilbogoev.com)" },
      { key: "size", type: "select", label: "Text size", default: "md", choices: { sm: "Small", md: "Normal", lg: "Large" } },
      align,
      logic,
    ],
  },
  image: {
    label: "Image",
    group: "content",
    icon: "image",
    controls: [
      { key: "image", type: "image", label: "Image", default: { id: 0, url: "" } },
      { key: "alt", type: "text", label: "Alt text", default: "" },
      { key: "caption", type: "text", label: "Caption", default: "" },
      { key: "width", type: "number", label: "Width (%)", default: 100, min: 10, max: 100 },
      { key: "rounded", type: "toggle", label: "Rounded corners", default: 1 },
      { key: "link", type: "text", label: "Link URL (optional)", default: "" },
      align,
      logic,
    ],
  },
  session: {
    label: "Session",
    group: "content",
    icon: "timer",
    controls: [...SESSION_CONTROLS, logic],
  },
  short_text: {
    label: "Short Text",
    group: "questions",
    icon: "short",
    input: true,
    controls: q("What is your answer?", [placeholder, { key: "max_length", type: "number", label: "Max characters (0 = no limit)", default: 0, min: 0 }]),
  },
  long_text: {
    label: "Long Text",
    group: "questions",
    icon: "long",
    input: true,
    controls: q("Tell us more", [
      placeholder,
      { key: "rows", type: "number", label: "Visible rows", default: 4, min: 2, max: 20 },
      { key: "max_length", type: "number", label: "Max characters (0 = no limit)", default: 0, min: 0 },
    ]),
  },
  email: {
    label: "Email",
    group: "questions",
    icon: "email",
    input: true,
    controls: q("What is your email?", [{ ...placeholder, default: "name@company.com" }]),
  },
  phone: {
    label: "Phone",
    group: "questions",
    icon: "phone",
    input: true,
    controls: q("What is your phone number?", [{ ...placeholder, default: "+971 50 000 0000" }]),
  },
  number: {
    label: "Number",
    group: "questions",
    icon: "number",
    input: true,
    numeric: true,
    controls: q("How many?", [
      placeholder,
      { key: "min", type: "text", label: "Minimum", default: "" },
      { key: "max", type: "text", label: "Maximum", default: "" },
      { key: "step", type: "text", label: "Step", default: "any" },
      { key: "unit", type: "text", label: "Unit label (e.g. AED, kg)", default: "" },
    ]),
  },
  website: {
    label: "Website",
    group: "questions",
    icon: "link",
    input: true,
    controls: q("What is your website?", [{ ...placeholder, default: "https://" }]),
  },
  date: {
    label: "Date",
    group: "questions",
    icon: "date",
    input: true,
    controls: q("Pick a date", [
      { key: "min", type: "text", label: 'Earliest date (YYYY-MM-DD or "today")', default: "" },
      { key: "max", type: "text", label: 'Latest date (YYYY-MM-DD or "today")', default: "" },
    ]),
  },
  choice: {
    label: "Multiple Options",
    group: "choice",
    icon: "choice",
    input: true,
    chart: true,
    controls: q("Choose an option", [
      options,
      { key: "multiple", type: "toggle", label: "Allow multiple selection", default: 0 },
      { key: "min_select", type: "number", label: "Minimum selections", default: 0, min: 0, show_if: "multiple" },
      { key: "max_select", type: "number", label: "Maximum selections (0 = unlimited)", default: 0, min: 0, show_if: "multiple" },
      order,
      { key: "allow_other", type: "toggle", label: 'Add "Other" with free text', default: 0 },
      { key: "layout", type: "select", label: "Layout", default: "list", choices: { list: "Vertical list", grid: "Two-column grid", inline: "Inline pills" } },
    ]),
  },
  dropdown: {
    label: "Dropdown",
    group: "choice",
    icon: "dropdown",
    input: true,
    chart: true,
    controls: q("Select one", [options, order, { ...placeholder, default: "Select..." }]),
  },
  yes_no: {
    label: "Yes / No",
    group: "choice",
    icon: "yesno",
    input: true,
    chart: true,
    controls: q("Do you agree?", [
      { key: "yes_label", type: "text", label: "Yes label", default: "Yes" },
      { key: "no_label", type: "text", label: "No label", default: "No" },
    ]),
  },
  rating: {
    label: "Rating",
    group: "choice",
    icon: "star",
    input: true,
    chart: true,
    numeric: true,
    controls: q("How would you rate us?", [
      { key: "max", type: "number", label: "Number of steps", default: 5, min: 3, max: 10 },
      { key: "shape", type: "select", label: "Shape", default: "star", choices: { star: "Stars", heart: "Hearts", circle: "Circles" } },
    ]),
  },
  scale: {
    label: "Opinion Scale / NPS",
    group: "choice",
    icon: "scale",
    input: true,
    chart: true,
    numeric: true,
    controls: q("How likely are you to recommend us to a friend?", [
      { key: "min", type: "select", label: "Start at", default: "0", choices: { "0": "0", "1": "1" } },
      { key: "max", type: "number", label: "End at", default: 10, min: 3, max: 10 },
      { key: "left_label", type: "text", label: "Left label", default: "Not likely" },
      { key: "right_label", type: "text", label: "Right label", default: "Very likely" },
    ]),
  },
  contact: {
    label: "Contact Details",
    group: "data",
    icon: "contact",
    input: true,
    unique: true,
    controls: [
      { key: "question", type: "text", label: "Heading", default: "Your contact details" },
      { key: "description", type: "textarea", label: "Description (Markdown)", default: "" },
      { key: "fields", type: "contact_fields", label: "Fields" },
      { key: "columns", type: "select", label: "Columns", default: "2", choices: { "1": "One column", "2": "Two columns" } },
      logic,
    ],
  },
  consent: {
    label: "Consent / Checkbox",
    group: "data",
    icon: "check",
    input: true,
    chart: true,
    controls: [
      { key: "question", type: "text", label: "Label (internal / responses column)", default: "Consent" },
      { key: "text", type: "markdown", label: "Checkbox text (Markdown, links allowed)", default: "I agree to the [privacy policy](/privacy-policy/)." },
      { key: "field_key", type: "field_key", label: "Program name (field key)" },
      { key: "required", type: "toggle", label: "Required", default: 1 },
      logic,
    ],
  },
  file: {
    label: "File Upload",
    group: "data",
    icon: "upload",
    input: true,
    controls: q("Upload a file", [
      { key: "types", type: "text", label: "Allowed extensions (empty = global setting)", default: "" },
      { key: "max_mb", type: "number", label: "Max size MB (0 = global setting)", default: 0, min: 0 },
    ]),
  },
  hidden: {
    label: "Hidden Field",
    group: "data",
    icon: "hidden",
    input: true,
    hidden: true,
    controls: [
      { key: "question", type: "text", label: "Label (internal)", default: "Campaign" },
      { key: "field_key", type: "field_key", label: "Program name (field key)" },
      { key: "param", type: "text", label: "Fill from URL parameter (e.g. utm_campaign)", default: "" },
      { key: "default", type: "text", label: "Default value", default: "" },
    ],
  },
  divider: {
    label: "Divider",
    group: "layout",
    icon: "divider",
    controls: [
      { key: "style", type: "select", label: "Style", default: "solid", choices: { solid: "Line", dashed: "Dashed", dotted: "Dotted", double: "Double", dots: "Three dots", accent: "Short accent bar" } },
      { key: "color", type: "color", label: "Color", default: "#E6E6E6" },
      { key: "thickness", type: "number", label: "Thickness (px)", default: 1, min: 1, max: 12 },
      { key: "width", type: "number", label: "Width (%)", default: 100, min: 5, max: 100 },
      { key: "spacing", type: "number", label: "Vertical spacing (px)", default: 24, min: 0, max: 200 },
      logic,
    ],
  },
  spacer: {
    label: "Spacer",
    group: "layout",
    icon: "spacer",
    controls: [{ key: "height", type: "number", label: "Height (px)", default: 32, min: 0, max: 400 }],
  },
  page_break: {
    label: "Page Break",
    group: "layout",
    icon: "pagebreak",
    controls: [{ key: "next_label", type: "text", label: "Next button label (empty = form default)", default: "" }],
  },
};

export function isBlockType(t: unknown): t is BlockType {
  return typeof t === "string" && Object.prototype.hasOwnProperty.call(BLOCK_TYPES, t);
}

export function isInput(type: string): boolean {
  return isBlockType(type) && !!BLOCK_TYPES[type].input;
}

export function defaultLogic(): Logic {
  return { enabled: 0, field: "", op: "equals", value: "" };
}

function clone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

/** Default settings of a list of controls. Shared by Forms blocks and the blocks of other modules (Landing Pages). */
export function defaultsFor(controls: Control[]): Settings {
  const out: Settings = {};
  for (const c of controls) {
    if (c.type === "contact_fields") {
      const f: Settings = {};
      for (const [k, cf] of Object.entries(CONTACT_FIELDS)) f[k] = { enabled: cf[1], required: cf[2], label: cf[0], key: k };
      out.fields = f;
    } else if (c.type === "logic") {
      out.logic = defaultLogic();
    } else if (c.type === "items") {
      out[c.key] = clone(c.default ?? []);
    } else if (c.default !== undefined) {
      out[c.key] = clone(c.default);
    }
  }
  return out;
}

/** Default settings of a block type. */
export function blockDefaults(type: BlockType): Settings {
  return defaultsFor(BLOCK_TYPES[type].controls);
}

/** Saved settings laid over the defaults (a deep merge, so new settings appear on old blocks). Items lists are kept as saved. */
export function mergeDefaults(base: Settings, saved: unknown): Settings {
  const merge = (b0: Settings, over: Settings): Settings => {
    const out: Settings = { ...b0 };
    for (const [k, v] of Object.entries(over)) {
      const b = b0[k];
      out[k] = b && v && typeof b === "object" && typeof v === "object" && !Array.isArray(b) && !Array.isArray(v) ? merge(b, v as Settings) : v;
    }
    return out;
  };
  return merge(base, saved && typeof saved === "object" ? (saved as Settings) : {});
}

export function withDefaults(type: BlockType, saved: unknown): Settings {
  return mergeDefaults(blockDefaults(type), saved);
}

/** Sanitize settings against a list of controls. */
export function sanitizeFor(controls: Control[], input: unknown): Settings {
  const out = defaultsFor(controls);
  if (!input || typeof input !== "object") return out;
  const s = input as Settings;
  for (const c of controls) {
    const k = c.key;
    if (c.type === "field_key" || !(k in s)) continue;
    const v = s[k];
    switch (c.type) {
      case "toggle":
        out[k] = toBool(v) ? 1 : 0;
        break;
      case "number": {
        let n = typeof v === "number" ? v : Number.parseFloat(String(v));
        if (!Number.isFinite(n)) n = typeof c.default === "number" ? c.default : 0;
        if (c.min !== undefined) n = Math.max(c.min, n);
        if (c.max !== undefined) n = Math.min(c.max, n);
        out[k] = n;
        break;
      }
      case "select":
        out[k] = c.choices && Object.prototype.hasOwnProperty.call(c.choices, String(v)) ? String(v) : c.default;
        break;
      case "color":
        out[k] = cleanHexColor(v) || c.default;
        break;
      case "textarea":
      case "markdown":
        out[k] = cleanMultiline(v);
        break;
      case "options":
        out[k] = (Array.isArray(v) ? v : []).map((o) => cleanText(o)).filter((o) => o !== "");
        break;
      case "image": {
        const img = (v ?? {}) as Settings;
        const value: Settings = { id: 0, url: cleanUrl(img.url) };
        // Pictures uploaded through Landing Pages carry their size and the widths of the stored copies.
        const w = Math.round(Number(img.width));
        const h = Math.round(Number(img.height));
        if (value.url && w > 0 && w < 20000 && h > 0 && h < 20000) {
          value.width = w;
          value.height = h;
          if (Array.isArray(img.variants)) {
            value.variants = img.variants
              .map((x: Settings) => ({ w: Math.round(Number(x?.w)), url: cleanUrl(x?.url) }))
              .filter((x: { w: number; url: string }) => x.url && x.w > 0 && x.w < 8000)
              .slice(0, 6);
          }
        }
        out[k] = value;
        break;
      }
      case "contact_fields": {
        const f = out.fields as Settings;
        const given = (v ?? {}) as Settings;
        for (const fk of Object.keys(f)) {
          const g = given[fk] as Settings | undefined;
          if (!g || typeof g !== "object") continue;
          f[fk].enabled = toBool(g.enabled) ? 1 : 0;
          f[fk].required = toBool(g.required) ? 1 : 0;
          const label = cleanText(g.label, 80);
          if (label) f[fk].label = label;
          f[fk].key = cleanKey(g.key) || fk;
        }
        break;
      }
      case "logic": {
        const l = (v ?? {}) as Settings;
        out[k] = {
          enabled: toBool(l.enabled) ? 1 : 0,
          field: cleanKey(l.field),
          op: LOGIC_OPS.includes(l.op) ? l.op : "equals",
          value: cleanText(l.value, 500),
        } satisfies Logic;
        break;
      }
      case "url":
        out[k] = cleanLink(v);
        break;
      case "form": {
        const n = Math.trunc(Number(v));
        out[k] = Number.isFinite(n) && n > 0 ? n : 0;
        break;
      }
      case "items": {
        const max = c.max ?? 24;
        const sub = c.fields ?? [];
        out[k] = (Array.isArray(v) ? v : [])
          .filter((it) => it && typeof it === "object")
          .slice(0, max)
          .map((it) => sanitizeFor(sub, it));
        break;
      }
      default:
        out[k] = k === "link" ? cleanUrl(v) : cleanText(v);
    }
  }
  return out;
}

/** Sanitize block settings against the type's schema. */
export function sanitizeBlockSettings(type: BlockType, input: unknown): Settings {
  return sanitizeFor(BLOCK_TYPES[type].controls, input);
}

export type Field = {
  key: string;
  label: string;
  type: BlockType | "contact";
  subtype: string;
  sub: string;
  required: number;
  blockId: number;
  block: Block;
};

/** The data fields a list of blocks produces, in order. */
export function fieldsOf(blocks: Block[]): Field[] {
  const out: Field[] = [];
  for (const b of blocks) {
    if (!isInput(b.type)) continue;
    const s = b.settings;
    if (b.type === "contact") {
      for (const [sub, cf] of Object.entries((s.fields ?? {}) as Settings)) {
        if (!cf.enabled) continue;
        out.push({ key: cf.key, label: cf.label, type: "contact", subtype: CONTACT_FIELDS[sub]?.[3] ?? "text", sub, required: cf.required ? 1 : 0, blockId: b.id, block: b });
      }
      continue;
    }
    if (b.fieldKey === "") continue;
    out.push({ key: b.fieldKey, label: s.question ? String(s.question) : b.fieldKey, type: b.type, subtype: "", sub: "", required: s.required ? 1 : 0, blockId: b.id, block: b });
  }
  return out;
}

/** Option list for chartable fields. */
export function fieldOptions(field: Field): string[] {
  const s = field.block.settings;
  switch (field.type) {
    case "choice":
    case "dropdown":
      return Array.isArray(s.options) ? s.options.map(String) : [];
    case "yes_no":
      return [String(s.yes_label), String(s.no_label)];
    case "consent":
      return ["Yes", "No"];
    case "rating":
      return Array.from({ length: Number(s.max) }, (_, i) => String(i + 1));
    case "scale": {
      const min = Number(s.min);
      return Array.from({ length: Number(s.max) - min + 1 }, (_, i) => String(min + i));
    }
  }
  return [];
}

export function isEmailField(f: Field): boolean {
  return f.type === "email" || (f.type === "contact" && f.subtype === "email");
}

/** Conditional logic. Returns whether the block is visible for the given values. */
export function logicVisible(l: Partial<Logic> | undefined, values: Record<string, string | string[] | undefined>): boolean {
  if (!l || !l.enabled || !l.field) return true;
  const v = values[l.field];
  const vals = Array.isArray(v) ? v.map(String) : [v === undefined || v === null ? "" : String(v)];
  const cmp = String(l.value ?? "").trim().toLowerCase();
  const low = vals.map((x) => x.trim().toLowerCase());
  const str = low.join(", ");
  const empty = vals.join("").trim() === "";
  switch (l.op) {
    case "equals":
      return low.includes(cmp);
    case "not_equals":
      return !low.includes(cmp);
    case "contains":
      return cmp !== "" && str.includes(cmp);
    case "not_contains":
      return cmp === "" || !str.includes(cmp);
    case "empty":
      return empty;
    case "not_empty":
      return !empty;
    case "gt":
      return !empty && Number.parseFloat(vals[0]) > Number.parseFloat(cmp);
    case "lt":
      return !empty && Number.parseFloat(vals[0]) < Number.parseFloat(cmp);
  }
  return true;
}
