import type { Offer } from "../types";

export const sessions: Offer = {
  slug: "sessions",
  name: "Sessions",
  eyebrow: "The Sessions",
  metaTitle: "AI Sessions: one practical problem solved, live",
  metaDescription:
    "A monthly live AI workshop for executives and business owners. One practical topic, a live demonstration, Q&A and the recording with Boril Bogoev, Ph.D. Free.",
  headline: "You do not need another course. You need one problem solved.",
  tagline: "Monthly fast-paced workshop on a specific practical topic and problem. Thursdays, 1 PM to 2 PM.",
  lead: [
    "Each Session takes one practical topic and works it live. I present, demonstrate on screen and answer your questions. You leave with the method, the deck and the recording to use it the next day.",
  ],
  facts: [
    { label: "Format", value: "Live webinar, about 1 hour" },
    { label: "When", value: "Thursdays, 1 PM to 2 PM" },
    { label: "Price", value: "FREE" },
  ],
  problem:
    "AI content is endless and mostly noise. Long courses bury the one thing you needed. You do not need more information. You need a working answer to a specific problem, then back to your day.",
  audience: [
    "Executives and business owners who want practical AI without a big time commitment.",
    "Leaders who want to see a method done live before they try it.",
    "People who want a first look at how I work before a bigger step.",
  ],
  gets: [
    "Webinar (online presentation, live) of about 1 hour.",
    "Webinar deck for download.",
    "Live demonstration.",
    "Q&A (answers from the chat plus questions sent in advance).",
    "Webinar recording as a practical video lesson.",
  ],
  steps: [
    { title: "Register", text: "Sign up. It is free." },
    { title: "Join live", text: "Presentation, demonstration and Q&A run inside the Thursday, 1 PM to 2 PM slot." },
    { title: "Apply", text: "Download the deck and watch the recording as a practical video lesson." },
    { title: "Go deeper", text: "When one problem is not enough, the Sprint works on your own business for a week." },
  ],
  plans: {
    heading: "What you get",
    intro: "Watch live. Get every resource and use it at will.",
    plans: [{ id: "free", name: "Free", price: "FREE" }],
    rows: [],
    deliverables: {
      eyebrow: "Deliverables",
      items: [
        "Webinar (online presentation, live) of about 1 hour",
        "Webinar deck for download",
        "Live demonstration",
        "Q&A (answers from the chat plus questions sent in advance)",
        "Webinar recording as a practical video lesson",
      ],
      price: "FREE",
    },
    currency: "AED",
    prices: [0],
  },
  notHeading: "What the Sessions are not",
  notItems: [
    "Not a lecture on AI news.",
    "Not a pitch in disguise.",
    "Not a demo of a tool you cannot use.",
    "Not a course you have to finish.",
  ],
  faq: [
    { q: "Is it really free?", a: "Yes. You get the live Session, the deck, the demonstration, the Q&A and the recording at no cost." },
    { q: "What if I miss the live Session?", a: "You still get the recording as a practical video lesson, so you can watch it when it suits you." },
    { q: "Can I send a question in advance?", a: "Yes. Questions sent in advance are answered in the Q&A, together with the ones from the chat." },
    { q: "What comes after the Sessions?", a: "The Sprint. One week, hands-on, on your own work." },
    { q: "How do I join?", a: "Sign up for the next Session, or send an inquiry below. I reply personally with the date and next steps." },
  ],
  inquiry: {
    heading: "Send an inquiry",
    intro: "Tell me who you are and what you want to ask. I reply personally with the next Session date.",
    formId: 7,
  },
  card: { summary: "A monthly live workshop. One practical problem, worked on screen, with Q&A.", from: "Free" },
  serviceType: "AI workshop",
};
