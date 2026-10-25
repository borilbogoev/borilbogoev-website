// Site-wide settings, navigation and contact points.

export const site = {
  name: "Boril Bogoev",
  fullName: "Boril Bogoev, Ph.D.",
  url: "https://borilbogoev.com",
  tagline: "Systems always win.",
  positioning: "From chaos to operating systems.",
  description:
    "Boril Bogoev, Ph.D. designs and builds AI-powered business operating systems. AI Jump, AI Sprint and AI Quest for executives and business owners.",
  jobTitle: "Head of AI & Automation",
  location: "Dubai, UAE",
  linkedin: "https://linkedin.com/in/borilbogoev",
  streamliner: "https://thestreamliner.beehiiv.com/",
  founderOf: "AIUGMENTIC",
} as const;

export type NavItem =
  | { kind: "internal"; label: string; href: string }
  | { kind: "streamliner"; label: string; href: string }
  | { kind: "portrait"; label: string; href: string }
  | { kind: "link"; label: string; href: string; newTab: boolean };

// The default menu. The live menu is set in Admin > Settings > Menus (src/modules/settings/lib/menu.ts); this is the fallback.
// The order follows the ladder: AI Jump, AI Sprint, AI Quest, then the portrait (About).
// There is no Home link: the B* mark is the home link.
export const nav: NavItem[] = [
  { kind: "internal", label: "AI Jump", href: "/l/ai-jump" },
  { kind: "internal", label: "AI Sprint", href: "/l/ai-sprint" },
  { kind: "internal", label: "AI Quest", href: "/l/ai-quest" },
  { kind: "portrait", label: "About", href: "/about" },
];

export const founderBio =
  "My name is Boril Bogoev, Ph.D. I am the founder of AIUGMENTIC. I hold PhD in Automated Digital Business Models. Master's in Automation and Robotics. 20+ years across graphic design, web development, marketing and AI orchestration. I teach what I build for clients.";
