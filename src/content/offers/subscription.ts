import type { Offer } from "../types";

export const subscription: Offer = {
  slug: "subscription",
  name: "Subscription",
  eyebrow: "The Subscription",
  metaTitle: "AI Subscription: ongoing AI support on retainer",
  metaDescription:
    "Ongoing AI consulting, building, fixing and improving on retainer with Boril Bogoev, Ph.D. You pay for hours of my time; the tier sets how many. Standard, Premium and VIP.",
  headline: "AI work does not end at launch. It needs an owner.",
  tagline:
    "Ongoing support and development on a retainer basis. The work is a fusion of consulting, building and fixing, and the price depends only on the hours of my time involved.",
  lead: [
    "The Subscription keeps me on your side month after month. Consulting, building, fixing and improving, on retainer. You pay for my hours, and the tier sets how many.",
  ],
  facts: [
    { label: "Format", value: "Monthly retainer" },
    { label: "Reporting", value: "A plan and a report every period" },
    { label: "Price", value: "From 3,999 AED per month" },
  ],
  problem:
    "Systems drift. Tools update, processes change, people leave and new ideas pile up with nobody to build them. Automations break quietly. Without an owner, the gains from your first project fade.",
  audience: [
    "Executives who finished the Sprint or the Shift and want continuity.",
    "Businesses that want ongoing AI development without hiring a team.",
    "Leaders who prefer one accountable partner over a list of freelancers.",
  ],
  gets: [
    "Consulting, training and coaching.",
    "A plan for the next period (week or month).",
    "A progress report for the past period.",
    "Troubleshooting and bug fixing.",
    "Improvement and optimization of your structures and processes.",
    "Automations, AI agents and custom apps built and deployed.",
  ],
  steps: [
    { title: "Choose", text: "Pick Standard, Premium or VIP." },
    { title: "Plan", text: "At the start of each period I plan the tasks ahead." },
    { title: "Work", text: "I consult, build, deploy, fix and optimize." },
    { title: "Report", text: "You get a progress report on the period, then the cycle repeats." },
  ],
  plans: {
    heading: "Choose your tier",
    intro: "All tiers include the same work. The tier sets the hours of my time each month.",
    plans: [
      { id: "standard", name: "Standard", price: "3,999 AED", priceNote: "per month" },
      { id: "premium", name: "Premium", price: "7,999 AED", priceNote: "per month" },
      { id: "vip", name: "VIP", price: "15,999 AED", priceNote: "per month" },
    ],
    rows: [],
    included: {
      heading: "Every tier includes",
      items: [
        "Consulting, training and coaching",
        "Planning tasks for the next period (week, month)",
        "Progress reporting for the past period (week, month)",
        "Troubleshooting and bug fixing",
        "Structures improvement and optimization",
        "Processes development and optimization",
        "Automations building and deploying",
        "AI agents building and deploying",
        "Custom apps building and deploying",
      ],
    },
    currency: "AED",
    prices: [3999, 7999, 15999],
  },
  notHeading: "What the Subscription is not",
  notItems: [
    "Not a software license.",
    "Not a fixed menu. The work follows your priorities.",
    "Not a black box. You get a report every period.",
    "Not unlimited. The tier sets the hours.",
  ],
  faq: [
    { q: "How do I choose a tier?", a: "Choose by how much work you want done each month. Standard for steady support. VIP for active development." },
    { q: "What do I get each period?", a: "A plan for the next period and a report on the last one, weekly or monthly." },
    { q: "Who does the work?", a: "I do. I consult, plan, build, deploy and fix." },
    { q: "Do I need the Sprint or the Shift first?", a: "No. The Subscription works alongside both." },
    { q: "How do I start?", a: "Send an inquiry below. I reply personally and we agree the tier." },
  ],
  inquiry: {
    heading: "Send an inquiry",
    intro: "Tell me what you want to keep improving. I reply personally with a tier and next steps.",
    planLabel: "Tier",
  },
  card: { summary: "Ongoing consulting, building and fixing on retainer. You pay for my hours; the tier sets how many.", from: "From 3,999 AED per month" },
  serviceType: "AI consulting retainer",
};
