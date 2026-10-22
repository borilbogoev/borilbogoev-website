// Brand check for a lesson: the copy and layout rules of the BORILBOGOEV design system, as warnings.
// It never blocks a save. The builder shows the result, so a lesson is fixed before students see it.
import type { Settings } from "./blocks";
import type { Lesson } from "./courses";

export type BrandIssue = { level: "warn" | "info"; blockId?: number; message: string };

const HYPE = /\b(revolutionary|game[- ]chang\w*|cutting[- ]edge|unlock\w*|supercharg\w*|skyrocket\w*|next[- ]level|world[- ]class|groundbreaking|disrupt\w*|10x|ultimate|secret sauce|mind[- ]blowing)\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;
const LONG_DASH = /[–—]/;
const SKIP_KEYS = new Set(["url", "href", "icon", "style", "size", "kind", "marker", "tone", "fit", "shape", "ratio", "columns", "layout", "code", "rows", "source", "variant", "pattern"]);

function strings(value: unknown, key = "", out: { key: string; value: string }[] = []) {
  if (typeof value === "string") {
    if (value && !SKIP_KEYS.has(key) && !/^(\/|#|https?:|mailto:|tel:)/i.test(value.trim())) out.push({ key, value });
  } else if (Array.isArray(value)) {
    for (const v of value) strings(v, key, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Settings)) if (!k.startsWith("_")) strings(v, k, out);
  }
  return out;
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function brandIssues(lesson: Pick<Lesson, "title" | "summary" | "image" | "blocks">): BrandIssue[] {
  const out: BrandIssue[] = [];
  const seen = new Set<string>();
  const flag = (rule: string, message: string, blockId?: number) => {
    if (seen.has(rule)) return;
    seen.add(rule);
    out.push({ level: "warn", blockId, message });
  };
  const parts = [...strings({ title: lesson.title, summary: lesson.summary }), ...lesson.blocks.flatMap((b) => strings(b.settings))];
  for (const { key, value } of parts) {
    if (EMOJI.test(value)) flag("emoji", "remove the emoji. The brand uses outline icons only.");
    if (value.includes("!")) flag("bang", "remove the exclamation mark. The brand tone is calm and exact.");
    if (LONG_DASH.test(value)) flag("dash", 'replace the long dash with a comma, a colon or "to".');
    const hype = HYPE.exec(value);
    if (hype) flag(`hype:${hype[0].toLowerCase()}`, `replace the hype word "${hype[0]}" with a concrete claim.`);
    if (key === "label" && words(value) > 4) flag(`btn:${value}`, `shorten "${value}" to two or three words.`);
  }
  for (const b of lesson.blocks) {
    const s = b.settings;
    if (b.type === "image" && s.image?.url && !String(s.alt ?? "").trim()) flag("alt", "add a description (alt text) to the picture.", b.id);
    if (b.type === "gallery" && (s.items as Settings[]).some((i) => i.image?.url && !String(i.alt ?? "").trim())) flag("alt-gallery", "add a description (alt text) to every picture in the grid.", b.id);
    if (b.type === "video" && !String(s.source ?? "").trim()) flag("video-empty", "a video block has no video yet.", b.id);
    if (b.type === "audio" && !String(s.url ?? "").trim()) flag("audio-empty", "an audio block has no file yet.", b.id);
    if (b.type === "audio" && s.url && !String(s.transcript ?? "").trim()) out.push({ level: "info", blockId: b.id, message: "add a transcript to the audio. It helps students who cannot listen." });
    if (b.type === "video" && s.source && !String(s.transcript ?? "").trim()) out.push({ level: "info", blockId: b.id, message: "add a transcript to the video. It helps students who cannot play sound." });
    if (b.type === "embed" && !s.url) flag("embed-empty", "an interactive embed has no address yet.", b.id);
    if (b.type === "poll" && ((s.options as string[]) ?? []).length < 2) flag("poll-options", "a poll needs at least two options.", b.id);
    if (b.type === "flashcards" && (s.items as Settings[]).length < 2) out.push({ level: "info", blockId: b.id, message: "flashcards work best with at least five cards." });
  }
  const red = lesson.blocks.filter((b) => b.type === "button" && b.settings.style === "primary" && b.settings.label).length;
  if (red > 1) flag("red", "more than one red primary button. The lesson already has one: Mark complete.");
  if (!lesson.summary.trim()) out.push({ level: "info", message: "add a one-sentence summary. It shows in the course outline." });
  if (!lesson.image?.url) out.push({ level: "info", message: "add a featured image." });
  return out;
}
