// Starting points for "New presentation". Copy follows the brand voice: short declarative sentences, no hype, no exclamation marks.
import type { Settings } from "./elements";
import type { DeckMode, DeckOrientation, DeckSettings } from "./settings";
import type { SlideKind } from "./slides";

export type DeckTemplate = {
  label: string;
  desc: string;
  mode?: DeckMode;
  orientation?: DeckOrientation;
  settings?: Partial<DeckSettings>;
  /** Slide kind, with optional edits to the first element of a given type: [kind, { heading: {...} }]. */
  slides: [SlideKind, Record<string, Settings>?][];
};

export const DECK_TEMPLATES: Record<string, DeckTemplate> = {
  blank: { label: "Blank deck", desc: "A cover slide and nothing else.", slides: [["cover"]] },

  talk: {
    label: "Talk, 20 minutes",
    desc: "Cover, agenda, three parts, numbers, a live demo, a quote, questions and a closing slide.",
    slides: [
      ["cover", { heading: { eyebrow: "Talk", text: "The title of the talk.", subtitle: "What the audience will be able to do afterwards." } }],
      ["agenda"],
      ["section", { heading: { eyebrow: "Part one", text: "The problem." } }],
      ["bullets", { heading: { eyebrow: "Context", text: "What is going wrong today." } }],
      ["section", { heading: { eyebrow: "Part two", text: "The system." }, text: { content: "02" } }],
      ["cards", { heading: { eyebrow: "The system", text: "Three parts that work together." } }],
      ["numbers"],
      ["demo"],
      ["quote"],
      ["questions"],
      ["closing"],
    ],
  },

  workshop: {
    label: "Workshop",
    desc: "A working session: presenter, agenda, process, an interactive embed, an exercise, a form and a close.",
    slides: [
      ["cover", { heading: { eyebrow: "Workshop", text: "The name of the workshop.", subtitle: "Who it is for and the result they leave with." } }],
      ["person"],
      ["agenda"],
      ["steps", { heading: { eyebrow: "Method", text: "How the session runs." } }],
      ["embed", { heading: { eyebrow: "Exercise", text: "Work on it together." } }],
      ["two_columns", { heading: { eyebrow: "Exercise", text: "Your turn." } }],
      ["form", { heading: { eyebrow: "Feedback", text: "Tell us how it went." } }],
      ["closing"],
    ],
  },

  pitch: {
    label: "Client pitch, portrait",
    desc: "A short deck for phones held upright: promise, proof, plan and one action.",
    orientation: "portrait",
    settings: { arrows: 0 },
    slides: [
      ["cover", { heading: { eyebrow: "Proposal", text: "The promise in one sentence.", subtitle: "Who it is for and the result they get." } }],
      ["compare", { heading: { eyebrow: "Difference", text: "Before and after." } }],
      ["numbers"],
      ["steps", { heading: { eyebrow: "Plan", text: "How we start." } }],
      ["closing"],
    ],
  },

  explainer: {
    label: "Accordion explainer",
    desc: "A long page that folds: one idea per section, each opens and closes. Good for guides and client handbooks.",
    mode: "accordion",
    settings: { subtitle: "Open a section to read it. Close it to keep the page short." },
    slides: [
      ["text", { heading: { eyebrow: "Overview", text: "What this guide covers." } }],
      ["bullets", { heading: { eyebrow: "Step one", text: "Start with the inputs." } }],
      ["steps", { heading: { eyebrow: "Step two", text: "Run the process." } }],
      ["table", { heading: { eyebrow: "Reference", text: "The options side by side." } }],
      ["closing"],
    ],
  },
};
