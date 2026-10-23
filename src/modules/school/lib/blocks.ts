// Lesson blocks. Same model as the Forms, Landing and Presentations blocks: one list of controls per type drives the builder
// inspector, the defaults and the validation. The content blocks are the Presentations elements, reused; the rest are
// specific to learning (video with Bunny.net, audio, callout, accordion, resources, checklist, question box, flashcards).
import { defaultsFor, mergeDefaults, sanitizeFor, type Control, type Settings } from "@/modules/forms/lib/blocks";
import { ELEMENTS, PLACEMENT_KEYS, EMBED_HOSTS, embedAllowed } from "@/modules/presentations/lib/elements";

export type { Control, Settings };
export { EMBED_HOSTS, embedAllowed };

export type BlockType =
  | "heading"
  | "text"
  | "bullets"
  | "image"
  | "gallery"
  | "video"
  | "audio"
  | "callout"
  | "quote"
  | "steps"
  | "cards"
  | "compare"
  | "accordion"
  | "code"
  | "table"
  | "resources"
  | "embed"
  | "button"
  | "checklist"
  | "question"
  | "poll"
  | "flashcards"
  | "divider"
  | "spacer";

export type BlockGroup = "text" | "media" | "learn" | "data" | "action" | "layout";

export const BLOCK_GROUPS: Record<BlockGroup, string> = {
  text: "Text",
  media: "Media",
  learn: "Practice",
  data: "Structure",
  action: "Action",
  layout: "Layout",
};

export type BlockDef = {
  label: string;
  group: BlockGroup;
  icon: string;
  desc: string;
  /** Defined by another module and reused here. */
  shared?: boolean;
  /** The student's own state is saved for this block (classroom_block_state). */
  interactive?: boolean;
  controls: Control[];
};

export type LessonBlock = { id: number; type: BlockType; settings: Settings };

const text = (key: string, label: string, def = "", help?: string): Control => ({ key, type: "text", label, default: def, help });
const area = (key: string, label: string, def = "", help?: string): Control => ({ key, type: "textarea", label, default: def, help });
const md = (key: string, label: string, def = "", help?: string): Control => ({ key, type: "markdown", label, default: def, help });
const url = (key: string, label: string, def = "", help?: string): Control => ({ key, type: "url", label, default: def, help });
const image = (key: string, label: string): Control => ({ key, type: "image", label, default: { id: 0, url: "" } });
const toggle = (key: string, label: string, def = 0, help?: string): Control => ({ key, type: "toggle", label, default: def, help });
const select = (key: string, label: string, def: string, choices: Record<string, string>): Control => ({ key, type: "select", label, default: def, choices });
const items = (key: string, label: string, fields: Control[], def: Record<string, unknown>[], item_label: string, max = 20, help?: string): Control => ({ key, type: "items", label, fields, default: def, item_label, max, help });

/** A Presentations element, reused: same fields without the slide-only placement controls. */
function reuse(key: keyof typeof ELEMENTS, group: BlockGroup, desc?: string): BlockDef {
  const e = ELEMENTS[key];
  return { label: e.label, group, icon: e.icon, desc: desc ?? e.desc, shared: true, controls: e.controls.filter((c) => !PLACEMENT_KEYS.has(c.key)) };
}

export const VIDEO_RATIOS = { "16:9": "Wide 16:9", "4:3": "Classic 4:3", "1:1": "Square", "9:16": "Vertical 9:16" };

export const BLOCKS: Record<BlockType, BlockDef> = {
  heading: reuse("heading", "text"),
  text: reuse("text", "text"),
  bullets: reuse("bullets", "text"),
  quote: reuse("quote", "text"),
  callout: {
    label: "Callout",
    group: "text",
    icon: "ps",
    desc: "A key takeaway, a tip, a warning or an example set apart from the text.",
    controls: [
      select("kind", "Kind", "takeaway", { takeaway: "Key takeaway", tip: "Tip", warning: "Watch out", example: "Example" }),
      text("title", "Title (optional)", ""),
      md("content", "Text (Markdown)", "One or two sentences the student should remember."),
    ],
  },
  image: reuse("image", "media"),
  gallery: reuse("gallery", "media"),
  video: {
    label: "Video",
    group: "media",
    icon: "video",
    desc: "A Bunny.net video (protected), YouTube or Vimeo. Loads on click, so the lesson stays fast.",
    controls: [
      text("source", "Video", "", "Bunny.net: paste the video ID or its embed link. YouTube and Vimeo: paste the link."),
      text("title", "Video title (for screen readers)", "Video"),
      image("poster", "Cover image (optional)"),
      select("ratio", "Shape", "16:9", VIDEO_RATIOS),
      text("caption", "Caption", ""),
      md("transcript", "Transcript (Markdown, optional)", "", "Helps students who cannot play sound and everyone who searches. Shown under the video."),
    ],
  },
  audio: {
    label: "Audio",
    group: "media",
    icon: "audio",
    desc: "An audio player for an MP3, or a Spotify link, with an optional transcript.",
    controls: [
      url("url", "Audio file (.mp3, .m4a) or Spotify link", ""),
      text("title", "Title", "Listen"),
      text("caption", "Short description", ""),
      md("transcript", "Transcript (Markdown, optional)", ""),
    ],
  },
  embed: reuse("embed", "media", "A live page inside the lesson: a prototype, a board, a calendar, a worksheet."),
  steps: reuse("steps", "data"),
  cards: reuse("cards", "data"),
  compare: reuse("compare", "data"),
  accordion: {
    label: "Accordion",
    group: "data",
    icon: "faq",
    desc: "Questions and answers, or any content that folds away until the student opens it.",
    controls: [
      text("title", "Title (optional)", ""),
      items("items", "Sections", [text("title", "Title", "Question or heading"), md("content", "Content (Markdown)", "")], [{ title: "First section", content: "The answer." }], "title", 20),
      toggle("first_open", "Open the first section", 0),
    ],
  },
  code: reuse("code", "data", "A snippet, a prompt or a workflow in a mono block, with a copy button."),
  table: reuse("table", "data"),
  resources: {
    label: "Resources",
    group: "action",
    icon: "download",
    desc: "Files and links for this lesson: slides, a template, a worksheet, further reading.",
    controls: [
      text("title", "Title", "Resources"),
      items("items", "Links", [text("label", "Name", "Worksheet"), url("url", "Link", ""), text("note", "Note (file type, size)", "")], [], "label", 20),
    ],
  },
  button: reuse("button", "action"),
  checklist: {
    label: "Checklist",
    group: "learn",
    icon: "check",
    desc: "Steps the student ticks off. Their ticks are saved.",
    interactive: true,
    controls: [text("title", "Title", "Before you move on"), { key: "items", type: "options", label: "Items", default: ["First step", "Second step"] }],
  },
  question: {
    label: "Question box",
    group: "learn",
    icon: "long",
    desc: "A question the student answers in their own words. The answer is saved, and can be sent to the instructor.",
    interactive: true,
    controls: [
      text("prompt", "Question", "What will you do differently this week?"),
      text("placeholder", "Hint inside the box", "Write a few sentences."),
      toggle("share", "Send the answer to the instructor", 0, "The instructor reads it in the lesson discussion. Other students never see it."),
      text("model", "Model answer (shown after the student saves)", ""),
    ],
  },
  poll: {
    label: "Poll",
    group: "learn",
    icon: "pie",
    desc: "A question with a few options. After voting, the student sees how the class answered. Votes are anonymous.",
    interactive: true,
    controls: [
      text("question", "Question", "What is your biggest time sink?"),
      { key: "options", type: "options", label: "Options (two to eight)", default: ["Email", "Meetings", "Reporting"] },
      toggle("multiple", "Students may pick more than one", 0),
      toggle("show_results", "Show the results after voting", 1),
    ],
  },
  flashcards: {
    label: "Flashcards",
    group: "learn",
    icon: "carousel",
    desc: "Cards with a question on the front and the answer on the back. Students mark what they know.",
    interactive: true,
    controls: [
      text("title", "Title", "Key terms"),
      items("items", "Cards", [text("front", "Front", "Term or question"), area("back", "Back", "Definition or answer")], [{ front: "Term", back: "Definition" }], "front", 40),
    ],
  },
  divider: reuse("divider", "layout"),
  spacer: reuse("spacer", "layout"),
};

export const BLOCK_KEYS = Object.keys(BLOCKS) as BlockType[];

export const isBlockType = (t: unknown): t is BlockType => typeof t === "string" && Object.prototype.hasOwnProperty.call(BLOCKS, t);

export const blockDefaults = (type: BlockType): Settings => defaultsFor(BLOCKS[type].controls);
export const blockWithDefaults = (type: BlockType, saved: unknown): Settings => mergeDefaults(blockDefaults(type), saved);
export const sanitizeBlock = (type: BlockType, input: unknown): Settings => sanitizeFor(BLOCKS[type].controls, input);

/** Blocks in which a student leaves something behind. */
export const isInteractive = (type: string) => isBlockType(type) && !!BLOCKS[type].interactive;
