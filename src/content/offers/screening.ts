import type { Offer } from "../types";

export const screening: Offer = {
  slug: "screening",
  name: "Screening",
  eyebrow: "The Screening",
  metaTitle: "AI Screening: find where AI pays before you spend",
  metaDescription:
    "A 10 or 100-question self-assessment and audit of your business for AI opportunity. You receive an analysis, a report and an action plan from Boril Bogoev, Ph.D.",
  headline: "Before you spend on AI, find out where it pays.",
  tagline: "10 or 100-question self-assessment audit for busy executives.",
  lead: [
    "The Screening is an audit of your business for AI opportunity. Start with 10 points for a quick read, or go to 100 for the detail. You receive an analysis, a report and an action plan.",
  ],
  facts: [
    { label: "Format", value: "10 or 100-point audit" },
    { label: "Output", value: "Analysis, report and action plan" },
    { label: "Price", value: "0 to 3,999 AED" },
  ],
  problem:
    "Most AI spending starts with a tool, not a diagnosis. Nobody has mapped the processes, ranked the opportunities or counted the cost of leaving things as they are. The money goes to the loudest idea, not the best one.",
  audience: [
    "Executives and owners who want to know where AI fits before they commit budget.",
    "Companies with manual, repetitive or scattered processes that were never mapped.",
    "Leaders considering the Shift who want the plan first.",
  ],
  gets: [
    "A self-assessment with an AI tool (10 points).",
    "The detailed audit by me (100 points).",
    "An AI-generated analysis, report and action plan.",
    "Premium adds my analysis report with an implementation plan.",
    "Premium adds your relevant processes mapped in detail and optimized.",
    "Premium adds detailed assessments and action plans for automation, AI agents and custom apps.",
    "Premium adds a 360-degree SHIFT map and action plan.",
  ],
  steps: [
    { title: "Assess", text: "Start with the 10-point self-assessment using an AI tool." },
    { title: "Audit", text: "Go deeper with the 100-point audit." },
    { title: "Receive", text: "You get an AI-generated analysis, report and action plan." },
    {
      title: "Go further",
      text: "On Premium, I map and optimize your processes, assess automation, AI agents and custom apps, and deliver one 360-degree SHIFT map and action plan.",
    },
  ],
  plans: {
    heading: "Choose your tier",
    intro: "Free gives you the diagnosis. Premium gives you the plan.",
    plans: [
      { id: "free", name: "Free", price: "0 AED" },
      { id: "premium", name: "Premium", price: "3,999 AED" },
    ],
    rows: [
      { feature: "Self-assessment with an AI tool (10 points)", values: [true, true] },
      { feature: "Detailed audit by Boril Bogoev, Ph.D. (100 points)", values: [true, true] },
      { feature: "AI-generated analysis, report and action plan", values: [true, true] },
      { feature: "Analysis report with implementation plan by Boril Bogoev", values: [false, true] },
      { feature: "Map the relevant processes in detail by Boril Bogoev", values: [false, true] },
      { feature: "Optimize the relevant processes by Boril Bogoev", values: [false, true] },
      { feature: "Detailed assessment for automation opportunities by Boril Bogoev", values: [false, true] },
      { feature: "Automation action plan by Boril Bogoev", values: [false, true] },
      { feature: "Detailed assessment for AI agents deployment by Boril Bogoev", values: [false, true] },
      { feature: "AI agents deployment action plan by Boril Bogoev", values: [false, true] },
      { feature: "Detailed assessment for custom app development by Boril Bogoev", values: [false, true] },
      { feature: "Custom apps development action plan by Boril Bogoev", values: [false, true] },
      { feature: "360-degree SHIFT map and action plan by Boril Bogoev", values: [false, true] },
    ],
    currency: "AED",
    prices: [0, 3999],
  },
  notHeading: "What the Screening is not",
  notItems: [
    "Not a generic checklist.",
    "Not a report that sits in a drawer.",
    "Not a pitch for tools.",
    "Not a build. It ends with the plan.",
  ],
  faq: [
    { q: "10 or 100 points?", a: "Start with 10 for a quick read of where you stand. Go to 100 when you want the detail." },
    {
      q: "Free or Premium?",
      a: "Free gives you an AI-generated analysis, report and action plan. Premium adds my own analysis, your processes mapped and optimized, and plans for automation, AI agents and custom apps.",
    },
    { q: "Does Premium include building?", a: "No. It ends with a 360-degree SHIFT map and action plan. The build is the Shift." },
    { q: "What comes after the Screening?", a: "The Shift. The Screening plans the work. The Shift develops, deploys and tests it." },
    { q: "How do I start?", a: "Send an inquiry below. I reply personally with next steps." },
  ],
  inquiry: {
    heading: "Send an inquiry",
    intro: "Tell me about your business and which tier you want. I reply personally with how to begin.",
    formId: 8,
  },
  card: { summary: "An audit of your business for AI opportunity, ending in an analysis, a report and an action plan.", from: "From 0 AED" },
  serviceType: "AI opportunity audit",
};
