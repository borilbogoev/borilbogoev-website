import type { Offer } from "../types";

export const sprint: Offer = {
  slug: "sprint",
  name: "Sprint",
  eyebrow: "The Sprint",
  metaTitle: "AI Sprint: one week of hands-on AI for executives",
  metaDescription:
    "A one-week, hands-on AI training program for founders and executives, with Boril Bogoev, Ph.D. Learn by doing on your own work. Monthly Cohort or Custom Sprint for your team.",
  headline: "You know AI matters. You don't have time to figure out where to start.",
  tagline: "AI Sprint for busy executives with Boril Bogoev, Ph.D. Hands-on AI training program with tangible outcome.",
  lead: [
    "The Sprint fixes that in one week. A hands-on training and supervised practice for executives and business owners. You learn by doing, on your own work, and leave with something that runs.",
  ],
  facts: [
    { label: "Duration", value: "1 week" },
    { label: "Format", value: "Monthly Cohort or Custom" },
    { label: "Price", value: "From 1,999 AED" },
  ],
  problem:
    "AI tools change every week. Courses are generic. Your calendar does not move. So you wait, and your competitors do not.",
  audience: [
    "Founders and C-suite executives who want to use AI themselves before they delegate it.",
    "Business owners who tried a few tools and got nothing lasting.",
    "Leaders preparing a company for AI who want to understand it first-hand.",
  ],
  gets: [
    "A self-assessment that shows where you stand today.",
    "Two live sessions with Boril Bogoev, Ph.D.",
    "A practical self-paced video course.",
    "Assignments you apply directly to your own work.",
    "Access to signature AI resources and assets.",
    "A questions and answers pool and a WhatsApp community.",
  ],
  steps: [
    { title: "Assess", text: "You start with a self-assessment, so you know your position before day one." },
    { title: "Learn", text: "Live sessions plus a video course you take at your own pace." },
    { title: "Apply", text: "Assignments on your real work, not case studies." },
    { title: "Get answers", text: "The questions pool and WhatsApp community keep help close. One week, start to finish." },
  ],
  plans: {
    heading: "Choose your format",
    intro: "Join a monthly Cohort, or book a Custom Sprint for your team.",
    plans: [
      { id: "cohort", name: "Cohort", sub: "Monthly", price: "1,999 AED", priceNote: "per person, or 500 USD" },
      { id: "custom", name: "Custom", sub: "On demand", price: "19,999 AED", priceNote: "or 5,500 USD" },
    ],
    rows: [
      { feature: "Self AI-assessment tool", values: [true, true] },
      { feature: "Detailed AI transformation audit", values: [false, true] },
      { feature: "Signature curriculum by Boril Bogoev, Ph.D.", values: [true, true] },
      { feature: "Fully customized curriculum", values: [false, true] },
      { feature: "Overall timeframe", values: ["1 week", "1 week"] },
      { feature: "Online live sessions", values: ["2", false] },
      { feature: "In-person live sessions (client's premises)", values: [false, "2"] },
      { feature: "Self-paced practical video course", values: [true, true] },
      { feature: "Access to all signature AI resources and assets", values: [true, true] },
      { feature: "Access to all tailor-made AI resources and assets", values: [false, true] },
      { feature: "Assignments for self-paced execution", values: [true, true] },
      { feature: "Assignments with supervised execution", values: [false, true] },
      { feature: "Questions and answers pool (online space)", values: [true, true] },
      { feature: "WhatsApp community access", values: [true, true] },
      { feature: "Dedicated WhatsApp community (client's only)", values: [false, true] },
    ],
    currency: "AED",
    prices: [1999, 19999],
  },
  notHeading: "What the Sprint is not",
  notItems: [
    "Not a tool tour.",
    "Not theory you forget by Monday.",
    "Not a certificate program.",
    "Not a pitch for software.",
  ],
  faq: [
    { q: "Do I need a technical background?", a: "No. If you run a business, you have what you need." },
    { q: "Cohort or Custom?", a: "Cohort if it is just you. Custom if you want your team, your processes and your premises." },
    { q: "What comes after the Sprint?", a: "The Shift. I streamline one process, one department or your whole organization with AI." },
    { q: "How do I join?", a: "Send an inquiry below. I reply personally with dates and next steps." },
  ],
  inquiry: {
    heading: "Send an inquiry",
    intro: "Tell me who you are and what you want to achieve. I reply personally with the next cohort date or a plan for your team.",
    planLabel: "Format",
  },
  card: { summary: "One week of hands-on training on your own work. Join a Cohort or book a Custom Sprint for your team.", from: "From 1,999 AED" },
  serviceType: "AI training program",
};
