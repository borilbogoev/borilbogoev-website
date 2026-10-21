// Shapes of the content files. Edit the files in src/content, never the components, to change what the site says.

export type Fact = { label: string; value: string };

export type Plan = {
  id: string;
  name: string;
  /** Small line under the name (Option 1, monthly, on demand). */
  sub?: string;
  price: string;
  /** Previous price, shown crossed out next to the current one. */
  oldPrice?: string;
  /** Second line under the price (per person, or the USD price). */
  priceNote?: string;
};

export type PlanRow = {
  feature: string;
  /** One value per plan: true = included, false = not included, string = shown as text. */
  values: (boolean | string)[];
};

export type Plans = {
  heading: string;
  intro: string;
  plans: Plan[];
  /** A comparison table. Leave empty to show only the price cards. */
  rows: PlanRow[];
  /** What every plan includes, shown as a checklist. */
  included?: { heading: string; items: string[] };
  /** Used in structured data: ISO currency and the numeric price of each plan, in plan order. */
  currency: string;
  prices: number[];
};

export type Step = { title: string; text: string };
export type Faq = { q: string; a: string };

export type Offer = {
  slug: "sessions" | "screening" | "sprint" | "shift" | "subscription";
  /** Navigation label and short name. */
  name: string;
  /** "The SESSIONS", used as the eyebrow of the hero. */
  eyebrow: string;
  /** <title> without the site suffix. */
  metaTitle: string;
  metaDescription: string;
  /** The h1. */
  headline: string;
  /** One line explaining what it is (from the money model). */
  tagline: string;
  /** Lead paragraph(s) under the headline. */
  lead: string[];
  facts: Fact[];
  problem: string;
  audience: string[];
  gets: string[];
  steps: Step[];
  plans: Plans;
  notHeading: string;
  notItems: string[];
  faq: Faq[];
  inquiry: { heading: string; intro: string; /** Number of the BB Forms inquiry form (Forms > Share). */ formId: number };
  /** The next live event: a strong feature hero shown above the default hero. */
  upcoming?: {
    label: string;
    title: string;
    subtitle?: string;
    text?: string;
    bullets?: string[];
    /** Optional picture (pre-compressed webp in /public/brand). Without it the date block fills the space. */
    image?: { src: string; width: number; height: number; alt: string };
    secondary?: { label: string; href: string };
    /** ISO date of the event, used for the <time> element. */
    iso: string;
    day: string;
    month: string;
    year: string;
    weekday: string;
    time: string;
    zone: string;
    signupUrl: string;
    signupLabel: string;
  };
  /** For the home page ladder. */
  card: { summary: string; from: string };
  /** The schema.org type used for the structured data. */
  serviceType: string;
};
