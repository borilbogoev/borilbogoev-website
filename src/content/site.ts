// Site-wide settings, navigation and contact points.
import { SCHOOL_LISTED } from "@/modules/school/lib/listing";

export const site = {
  name: "Boril Bogoev",
  fullName: "Boril Bogoev, Ph.D.",
  url: "https://borilbogoev.com",
  tagline: "Systems always win.",
  positioning: "From chaos to operating systems.",
  description:
    "Boril Bogoev, Ph.D. designs and builds AI-powered business operating systems. Sessions, Screening, Sprint, Shift and Subscription for executives and business owners.",
  jobTitle: "Head of AI & Automation",
  location: "Dubai, UAE",
  linkedin: "https://linkedin.com/in/borilbogoev",
  streamliner: "https://thestreamliner.beehiiv.com/",
  founderOf: "AIUGMENTIC",
} as const;

export type NavItem =
  | { kind: "internal"; label: string; href: string }
  | { kind: "streamliner"; label: string; href: string }
  | { kind: "portrait"; label: string; href: string };

// The order follows the money model: The Streamliner, then Sessions, the School, the paid ladder and the portrait (About).
// There is no Home link: the B* mark is the home link.
export const nav: NavItem[] = [
  { kind: "streamliner", label: "The Streamliner", href: site.streamliner },
  { kind: "internal", label: "Sessions", href: "/sessions" },
  ...(SCHOOL_LISTED ? [{ kind: "internal" as const, label: "School", href: "/school" }] : []),
  { kind: "internal", label: "Screening", href: "/screening" },
  { kind: "internal", label: "Sprint", href: "/sprint" },
  { kind: "internal", label: "Shift", href: "/shift" },
  { kind: "internal", label: "Subscription", href: "/subscription" },
  { kind: "portrait", label: "About", href: "/about" },
];

export const founderBio =
  "My name is Boril Bogoev, Ph.D. I am the founder of AIUGMENTIC. I hold PhD in Automated Digital Business Models. Master's in Automation and Robotics. 20+ years across graphic design, web development, marketing and AI orchestration. I teach what I build for clients.";
