import type { Offer } from "../types";

export const shift: Offer = {
  slug: "shift",
  name: "Shift",
  eyebrow: "The Shift",
  metaTitle: "The Shift: AI streamlining with fixed scope and price",
  metaDescription:
    "Fast-paced, productized AI transformation of one process, one department or your whole organization. Audit, plan, build, test and hand over, with Boril Bogoev, Ph.D.",
  headline: "Your business runs on processes. Most were built before AI. The Shift rebuilds them.",
  tagline:
    "AI streamlining with Boril Bogoev, Ph.D. Fast-paced productized (service-as-a-software) AI transformation, working with structure, processes, automation, AI agents and custom apps.",
  lead: [
    "Fixed scope, fixed timeframe, fixed price. You choose one process, one department or the whole organization. I audit, plan, build, test and hand over.",
  ],
  facts: [
    { label: "Scope", value: "Process, department or organization" },
    { label: "Timeframe", value: "1 week to 1 quarter" },
    { label: "Price", value: "From 19,999 AED" },
  ],
  problem:
    "Tools alone change nothing. Teams add AI on top of broken processes and get faster chaos. There is no map, no plan and no owner for the result.",
  audience: [
    "Executives and owners who want AI results in daily operations, not experiments.",
    "Companies with manual, repetitive or scattered processes.",
    "Leaders who want one partner to audit, plan, build and hand over.",
  ],
  gets: [
    "An audit of your chosen scope, including a detailed review by Boril Bogoev, Ph.D.",
    "Your relevant processes mapped in detail and optimized.",
    "Assessments and action plans for automation, AI agents and custom apps.",
    "Everything planned is developed, deployed and tested.",
    "A 360-degree SHIFT map and action plan.",
    "Your team trained, with a supervised handover.",
  ],
  steps: [
    { title: "Audit", text: "AI-assisted analysis first, then a detailed audit by me. You receive an analysis report with an implementation plan." },
    { title: "Map and optimize", text: "The relevant processes are mapped in detail, then optimized." },
    { title: "Plan", text: "Detailed assessments and action plans for automation, AI agents and custom apps, combined in one 360-degree SHIFT map." },
    { title: "Build", text: "The planned automations, AI agents and custom apps are developed and deployed." },
    { title: "Test", text: "Detailed testing and troubleshooting for each, then 360-degree testing of the whole." },
    { title: "Hand over", text: "Your team is trained. The handover is supervised." },
  ],
  plans: {
    heading: "Choose your scope",
    intro: "One process, one department or the whole organization. Every option includes the same work.",
    plans: [
      { id: "process", name: "Process", sub: "Option 1", price: "19,999 AED" },
      { id: "department", name: "Department", sub: "Option 2", price: "39,999 AED" },
      { id: "organization", name: "Organization", sub: "Option 3", price: "79,999 AED" },
    ],
    rows: [
      { feature: "Scope of AI streamlining", values: ["1 process", "1 department", "1 organization"] },
      { feature: "Timeframe (estimated)", values: ["1 week", "1 month", "1 quarter"] },
    ],
    included: {
      heading: "Every option includes",
      items: [
        "Initial audit with AI tools and analysis",
        "Detailed audit by Boril Bogoev, Ph.D.",
        "Detailed analysis report with implementation plan",
        "Map and optimize the relevant processes in detail",
        "Detailed assessment and action plan for automation opportunities",
        "Detailed assessment and action plan for AI agents deployment",
        "Detailed assessment and action plan for custom app development",
        "360-degree SHIFT map and action plan",
        "Develop and deploy the planned automations, with detailed testing and troubleshooting",
        "Develop and deploy the planned AI agents, with detailed testing and troubleshooting",
        "Develop and deploy the planned custom apps, with detailed testing and troubleshooting",
        "360-degree testing and troubleshooting",
        "Client's team training for handover",
        "Supervised handover",
      ],
    },
    currency: "AED",
    prices: [19999, 39999, 79999],
  },
  notHeading: "What the Shift is not",
  notItems: [
    "Not a strategy deck.",
    "Not a tool installation.",
    "Not a pilot that stays a pilot.",
    "Not a handover without training.",
  ],
  faq: [
    {
      q: "Process, department or organization?",
      a: "Start with the smallest scope that hurts most. A process takes 1 week, a department 1 month, an organization 1 quarter.",
    },
    { q: "Do you advise or build?", a: "Both. I plan, develop, deploy and test. Then I train your team and supervise the handover." },
    {
      q: "Do I need the Sprint first?",
      a: "The Sprint builds your own AI skills in one week. The Shift changes how your business runs. They answer different needs.",
    },
    { q: "How do I start?", a: "Send an inquiry below. I reply personally and we define your scope." },
  ],
  inquiry: {
    heading: "Send an inquiry",
    intro: "Tell me which process, department or organization you want to shift. I reply personally with a scope and next steps.",
    formId: 10,
  },
  card: { summary: "Rapid AI transformation of one process, one department or your organization. Fixed scope, timeframe and price.", from: "From 19,999 AED" },
  serviceType: "AI transformation and process automation",
};
