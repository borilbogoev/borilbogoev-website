// Starting points for "New landing page". Copy follows the brand voice: short declarative sentences, no hype, no exclamation marks.
import type { LandingBlockType, Settings } from "./blocks";
import type { LandingSettings } from "./settings";

export type PageTemplate = {
  label: string;
  desc: string;
  settings?: Partial<LandingSettings>;
  blocks: [LandingBlockType, Settings?][];
};

export const TEMPLATES: Record<string, PageTemplate> = {
  blank: { label: "Blank page", desc: "Start from scratch with an empty canvas.", blocks: [] },

  webinar: {
    label: "Webinar registration",
    desc: "Hero with image, what you learn, host, questions and the registration form.",
    settings: { chrome: "minimal", sticky_label: "Reserve My Seat", sticky_url: "#form" },
    blocks: [
      ["hero_image", { eyebrow: "Free Webinar", headline: "What the visitor will be able to do after it", subtitle: "For whom, and the result in plain words.", cta_label: "Reserve My Seat", cta_url: "#form", note: "Free · 45 minutes · Replay included" }],
      ["features", { eyebrow: "What you will learn", heading: "Three things you take away.", items: [{ icon: "spark", title: "First outcome", text: "One sentence that names the result." }, { icon: "workflow", title: "Second outcome", text: "One sentence that names the result." }, { icon: "chart", title: "Third outcome", text: "One sentence that names the result." }] }],
      ["bio", { eyebrow: "Your host", name: "Boril Bogoev, Ph.D.", role: "Head of AI and Automation", text: "I design and build AI-powered business operating systems. 20+ years across marketing, web and automation.", credentials: ["PhD in Automated Digital Business Models", "Founder of AIUGMENTIC"] }],
      ["form", { eyebrow: "Registration", heading: "Reserve your seat.", display: "inline" }],
      ["faq", { eyebrow: "FAQ", heading: "Questions.", items: [{ q: "Will there be a replay?", a: "Yes. Everyone who registers receives the recording." }, { q: "What does it cost?", a: "Nothing. The webinar is free." }] }],
    ],
  },

  lead_magnet: {
    label: "Lead magnet",
    desc: "A free guide or checklist: short hero, what is inside and a download form.",
    settings: { chrome: "minimal" },
    blocks: [
      ["hero", { eyebrow: "Free Guide", headline: "The name of the guide", subtitle: "What it helps the reader do, in one line.", cta_label: "Get The Guide", cta_url: "#form" }],
      ["list", { eyebrow: "Inside", heading: "What is in the guide.", items: ["First point", "Second point", "Third point", "Fourth point"] }],
      ["form", { eyebrow: "Download", heading: "Where should we send it.", display: "inline" }],
    ],
  },

  sales: {
    label: "Offer page",
    desc: "Long form: promise, video, benefits, proof, pricing, guarantee, questions and a P.S.",
    settings: { chrome: "minimal", sticky_label: "See Pricing", sticky_url: "#pricing" },
    blocks: [
      ["hero", { eyebrow: "The offer", headline: "The promise in one sentence", subtitle: "Who it is for and the result they get.", cta_label: "See Pricing", cta_url: "#pricing" }],
      ["video", { eyebrow: "Watch", heading: "See how it works.", title: "Overview video" }],
      ["features", { eyebrow: "Outcome", heading: "What you get." }],
      ["stats", { eyebrow: "Results", heading: "The numbers." }],
      ["testimonials", { eyebrow: "Clients", heading: "What they say." }],
      ["pricing", { anchor: "pricing", eyebrow: "Pricing", heading: "Choose your plan." }],
      ["guarantee", { heading: "You risk nothing." }],
      ["faq", { eyebrow: "FAQ", heading: "Questions." }],
      ["cta", { length: "long", heading: "Ready to start.", cta_label: "See Pricing", cta_url: "#pricing" }],
      ["ps", { text: "Restate the one reason to act now." }],
    ],
  },
};
