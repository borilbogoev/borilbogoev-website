import type { Offer } from "../types";

export const sessions: Offer = {
  slug: "sessions",
  name: "Sessions",
  eyebrow: "The Sessions",
  metaTitle: "AI Sessions: one practical problem solved, live",
  metaDescription:
    "A monthly live AI workshop for executives and business owners. One practical topic, a live demonstration and Q&A with Boril Bogoev, Ph.D. Free, Premium and VIP tiers.",
  headline: "You do not need another course. You need one problem solved.",
  tagline: "Monthly fast-paced workshop on a specific practical topic and problem. Every Thursday, 12 PM to 2 PM.",
  lead: [
    "Each Session takes one practical topic and works it live. I present, demonstrate on screen and answer your questions. You leave with the method and, on Premium and VIP, the assets to use it the next day.",
  ],
  facts: [
    { label: "Format", value: "Live webinar, about 1 hour" },
    { label: "When", value: "Every Thursday, 12 PM to 2 PM" },
    { label: "Price", value: "0 to 999 AED" },
  ],
  problem:
    "AI content is endless and mostly noise. Long courses bury the one thing you needed. You do not need more information. You need a working answer to a specific problem, then back to your day.",
  audience: [
    "Executives and business owners who want practical AI without a big time commitment.",
    "Leaders who want to see a method done live before they try it.",
    "People who want a first look at how I work before a bigger step.",
  ],
  gets: [
    "A live webinar of about one hour on one practical topic.",
    "A live demonstration, not slides alone.",
    "Q&A: questions from the chat and the ones you send in advance.",
    "The webinar deck to download.",
    "Premium and VIP add the recording as a practical video lesson, all templates, assets and resources, guides to apply them, the foundational course \"Using AI\" and the WhatsApp community.",
    "VIP adds one 1-1 session of about 2 hours, in person or by video call.",
  ],
  steps: [
    { title: "Register", text: "Pick your tier. Free costs nothing." },
    { title: "Join live", text: "Presentation, demonstration and Q&A run inside the Thursday, 12 PM to 2 PM slot." },
    { title: "Apply", text: "Download the deck. Premium and VIP also get the recording, templates and guides." },
    { title: "Go deeper", text: "VIP members book a 1-1 session with me." },
  ],
  plans: {
    heading: "Choose your tier",
    intro: "Start free. Add the recording and resources with Premium, or a 1-1 session with VIP.",
    plans: [
      { id: "free", name: "Free", price: "0 AED" },
      { id: "premium", name: "Premium", price: "499 AED" },
      { id: "vip", name: "VIP", price: "999 AED" },
    ],
    rows: [
      { feature: "Webinar (online presentation, live) of about 1 hour", values: [true, true, true] },
      { feature: "Webinar deck for download", values: [true, true, true] },
      { feature: "Live demonstration", values: [true, true, true] },
      { feature: "Q&A (answers from the chat plus questions sent in advance)", values: [true, true, true] },
      { feature: "Webinar recording as a practical video lesson", values: [false, true, true] },
      { feature: "All templates, assets and resources to download", values: [false, true, true] },
      { feature: "Guide(s) to apply the resources in real life", values: [false, true, true] },
      { feature: "Foundational course access: \"Using AI\"", values: [false, true, true] },
      { feature: "WhatsApp community access", values: [false, true, true] },
      { feature: "1-1 session (in person or video call) of about 2 hours", values: [false, false, true] },
    ],
    currency: "AED",
    prices: [0, 499, 999],
  },
  notHeading: "What the Sessions are not",
  notItems: [
    "Not a lecture on AI news.",
    "Not a pitch in disguise.",
    "Not a demo of a tool you cannot use.",
    "Not a course you have to finish.",
  ],
  faq: [
    { q: "Is the Free tier really free?", a: "Yes. You get the live Session, the deck, the demonstration and the Q&A at no cost." },
    { q: "What if I miss the live Session?", a: "Premium and VIP include the recording as a practical video lesson. Free does not." },
    { q: "Premium or VIP?", a: "Premium if you want to apply it on your own. VIP if you want me to work through your case in a 1-1 session." },
    { q: "What comes after the Sessions?", a: "The Sprint. One week, hands-on, on your own work." },
    { q: "How do I join?", a: "Send an inquiry below. I reply personally with the next date and next steps." },
  ],
  inquiry: {
    heading: "Send an inquiry",
    intro: "Tell me who you are and which tier you want. I reply personally with the next Session date.",
    planLabel: "Tier",
  },
  card: { summary: "A monthly live workshop. One practical problem, worked on screen, with Q&A.", from: "From 0 AED" },
  serviceType: "AI workshop",
};
