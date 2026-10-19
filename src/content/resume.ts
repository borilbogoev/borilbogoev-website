// The resume, ported from the BB Resume WP plugin (v2.0.0). Edit here to change the About page.

export type Job = {
  id: string;
  /** Short label on the tab. */
  tab: string;
  company: string;
  /** The company is shown with "AI" in red (AIUGMENTIC). */
  aiBrand?: boolean;
  role: string;
  place: string;
  period: string;
  /** schema.org dates, for structured data. */
  start: string;
  end?: string;
  intro?: string;
  bullets: string[];
  results: string[];
};

export const resumeHero = {
  badge: "Systems always win.",
  name: ["Boril", "Bogoev"],
  credential: "Ph.D.",
  role: "Head of AI & Automation · Workflow Orchestration Leader",
  description:
    "AI and automation leader with 20+ years of experience driving workflow orchestration, internal AI adoption, and digital operating systems across SaaS, healthcare, retail, fintech, and enterprise platforms.",
  location: "Dubai, UAE",
};

export const stats = [
  { value: "20", label: "Years of experience" },
  { value: "100", label: "Brands worked with" },
  { value: "350", label: "Web apps built" },
  { value: "10k", label: "Professionals trained" },
];

export const profile = {
  heading: "From chaos to operating systems",
  paragraphs: [
    "I design and build AI-powered business operating systems. My work sits at the intersection of marketing, automation, workflow engineering, and operational strategy. The repeating pattern across my career: enter a complex field, learn it deeply, turn it into frameworks, and build tools around it.",
    "I started as a graphic designer, moved into web development, then marketing leadership, and eventually into AI automation architecture. Each layer compounds. Today, I help organizations replace manual chaos with structured, measurable, AI-integrated workflows.",
    "I hold a **Ph.D. in Digital Business Automation** and an **M.Sc. in AI & Robotics Engineering**. I have worked across FinTech, E-commerce, HealthTech, Retail, EdTech, and enterprise software, including senior roles at BinHendi Holding (7 brands), Yugen Care, and Signature Technology.",
    "I have published a book on automated internet business systems, taught at New Bulgarian University and SoftUni, and built and led teams of 20+ people.",
  ],
  cards: [
    { icon: "spark", title: "AI Adoption Programs", text: "Company-wide AI enablement, training, governance frameworks, and measurable adoption rollouts." },
    { icon: "workflow", title: "Workflow Automation", text: "End-to-end process automation using n8n, Make, and custom AI agents across marketing, sales, and operations." },
    { icon: "chart", title: "Operating Systems Design", text: "SOP libraries, dashboards, KPI systems, and governance structures that turn scattered activity into structured execution." },
    { icon: "book", title: "Training & Education", text: "Corporate AI workshops, modular learning paths, and training programs for executives, founders, and teams." },
  ],
} as const;

export const jobs: Job[] = [
  {
    id: "aiugmentic",
    tab: "AIUGMENTIC",
    company: "AIUGMENTIC",
    aiBrand: true,
    role: "Head of AI Transformation & Automation",
    place: "Dubai, UAE",
    period: "Aug 2025 to Present",
    start: "2025-08",
    bullets: [
      "Lead internal and client-facing AI adoption programs focused on replacing manual operations with automated workflows.",
      "Designed end-to-end workflow automation across marketing, sales, operations, and reporting using n8n, Make, and AI agents.",
      "Built automation governance frameworks ensuring reliability, monitoring, and continuous improvement.",
      "Rolled out company-wide AI enablement programs and hands-on training.",
      "Developed standardized SOP libraries and internal knowledge systems.",
      "Implemented data pipelines and dashboards for operational visibility.",
    ],
    results: ["~40% reduction in manual workload", "~30% improvement in execution speed", "Stable daily AI usage across teams"],
  },
  {
    id: "tanzor",
    tab: "Tanzor Labs",
    company: "Tanzor Labs",
    role: "Head of AI Marketing & Process Automation",
    place: "Dubai, UAE",
    period: "Apr 2025 to Aug 2025",
    start: "2025-04",
    end: "2025-08",
    bullets: [
      "Designed hybrid human + AI operating models for growth and operations.",
      "Mapped business processes into automated workflow systems.",
      "Built multi-agent AI frameworks for content production, lead handling, and client operations.",
      "Introduced governance controls and escalation paths.",
      "Led automation enablement sessions for teams.",
    ],
    results: ["Repeatable automation systems across departments", "Faster delivery cycles and clearer ownership"],
  },
  {
    id: "binhendi",
    tab: "BinHendi",
    company: "BinHendi Holding",
    role: "Group Head of Marketing & Automation",
    place: "Dubai, UAE · Retail holding, 7 brands",
    period: "Oct 2023 to Jul 2025",
    start: "2023-10",
    end: "2025-07",
    intro: "ZILLI (luxury men's fashion), Baituti Home (luxury Italian furniture), Joe's Cafe, Sammach Spot, Texas Instruments, BinHendi Play, VOSS.",
    bullets: [
      "Built centralized digital operating system for marketing execution and reporting across 7 brands.",
      "Standardized cross-brand KPIs, workflows, and governance structures.",
      "Automated reporting, content flows, and approval processes.",
      "Embedded AI tools into daily team operations.",
      "Created prompt libraries, automation playbooks, and SOP frameworks.",
    ],
    results: ["~30% increase in execution speed", "~40% reduction in manual reporting", "100% visibility across departments"],
  },
  {
    id: "yugen",
    tab: "Yugen Care",
    company: "Yugen Care by Dr. Gehad",
    role: "Chief Marketing Officer",
    place: "Dubai, UAE · Healthcare startup, 9 departments",
    period: "Sep 2022 to Jun 2023",
    start: "2022-09",
    end: "2023-06",
    intro: "Innovative wellness and beauty clinic with 10+ high-tech diagnostic and treatment technology setups.",
    bullets: [
      "Built automated marketing operations and analytics systems.",
      "Implemented AI segmentation and performance dashboards.",
      "Developed SOPs and onboarding workflows.",
    ],
    results: ["~25% increase in lead conversion", "~50% reduction in campaign setup time", "~60% reduction in onboarding time"],
  },
  {
    id: "signature",
    tab: "Signature Tech",
    company: "Signature Technology",
    role: "Chief Marketing Officer",
    place: "Dubai, UAE · E-commerce (Mazzady, Storeus)",
    period: "Nov 2018 to Jun 2022",
    start: "2018-11",
    end: "2022-06",
    intro: "SaaS marketplace and online auction platforms covering two distinct product lines.",
    bullets: [
      "Designed company-wide automation frameworks.",
      "Implemented workflow orchestration across growth and operations.",
      "Built performance measurement systems.",
    ],
    results: ["Faster go-to-market cycles", "Reduced operational friction"],
  },
  {
    id: "bfashion",
    tab: "BFashion",
    company: "BFashion",
    role: "Marketing and UX Director",
    place: "Sofia, Bulgaria · Top fashion e-commerce in CEE (14 countries, 8 languages)",
    period: "Jul 2014 to Jan 2018",
    start: "2014-07",
    end: "2018-01",
    bullets: [
      "Led a team of 20+ across marketing, UX, and analytics.",
      "Implemented automated content and CRO systems.",
      "Built scalable multi-market execution workflows.",
    ],
    results: ["~18% increase in checkout conversion", "Faster release cycles"],
  },
  {
    id: "global",
    tab: "Global Consulting",
    company: "Global Consulting",
    role: "Product Manager · UX & Pre-Sales Expert · Marketing & Design Lead",
    place: "Sofia, Bulgaria · B2B software for banking and government",
    period: "Jul 2005 to Jul 2014",
    start: "2005-07",
    end: "2014-07",
    intro: "Leading B2B provider of back-office systems for all major banks and government institutions in Bulgaria.",
    bullets: ["Led 200+ digital system implementations.", "Built standardized delivery workflows.", "Designed cross-team operating processes."],
    results: ["~40% improvement in project success rate", "~60% reduction in pre-launch rework"],
  },
];

export type SkillGroup = { id: string; label: string; primary: string[]; secondary: string[] };

export const skillGroups: SkillGroup[] = [
  {
    id: "core",
    label: "Core Expertise",
    primary: [
      "Internal AI Adoption Programs",
      "Workflow Automation at Scale",
      "Business Process Automation",
      "Automation Governance & Standards",
      "n8n Workflow Orchestration",
      "AI Agents & RAG Pipelines",
      "Cross-Functional Enablement",
      "Operational Analytics & Dashboards",
      "SOP & Knowledge Systems",
      "Change Management Through Systems",
    ],
    secondary: ["Prompt Engineering", "Marketing Operations", "Data Pipeline Design", "Digital Operating Systems"],
  },
  {
    id: "technical",
    label: "Technical",
    primary: [
      "AI-Powered Marketing Workflows",
      "Marketing Automation",
      "Workflow Automation (No-Code)",
      "AI-Based Client Segmentation",
      "KPI & OKR Systems Setup",
    ],
    secondary: [
      "Performance Analytics & Dashboards",
      "MarTech Stack Implementation",
      "Digital Platform Scaling",
      "CRM Systems Management",
      "A/B Testing & CRO",
      "UX Strategy & Design Systems",
      "Business Process Mapping",
      "Website & Mobile App Oversight",
      "User Acceptance Testing (UAT)",
    ],
  },
  {
    id: "marketing",
    label: "Marketing & Business",
    primary: ["Marketing Governance & Process Design", "Business Strategy Development", "Growth Marketing"],
    secondary: [
      "Campaign Management & Execution",
      "Integrated Marketing Communications",
      "Lead Conversion Optimization",
      "Traffic Acquisition Strategy",
      "Customer Retention Strategy",
      "Affiliate Program Development",
      "Cross-Brand Coordination",
      "Brand Building & Visual Identity",
      "Pre-Sales Enablement",
      "B2B & B2G Digital Solutions",
      "FinTech Platform Development",
    ],
  },
  {
    id: "leadership",
    label: "Leadership",
    primary: ["Team Building & Leadership", "Stakeholder Alignment", "Strategic Planning & Execution"],
    secondary: [
      "Internal Knowledge Systems (SOPs, Wikis)",
      "Cross-Functional Collaboration",
      "Communication & Storytelling",
      "Problem Solving & Prioritization",
      "Cost Optimization Strategies",
      "Documentation & Specification Writing",
      "Empathy & Emotional Intelligence",
      "Presentation Design",
      "Copywriting",
    ],
  },
];

export const tools = [
  "n8n", "Make.com", "Zapier", "Notion", "Airtable", "Gumloop", "Relevance AI", "ChatGPT", "Claude", "MidJourney", "Mailchimp",
  "Figma", "Whimsical", "Miro", "ClickUp", "Google Ads", "Meta Ads", "Canva", "Adobe Creative Suite", "Microsoft 365", "Google Workspace",
];

export const education = [
  { badge: "Doctorate", degree: "Ph.D. in Digital Business Automation", school: "University of Library Studies and Information Technologies, Sofia, Bulgaria" },
  { badge: "Master's", degree: "M.Sc. in AI & Robotics Engineering", school: "Technical University of Sofia, Sofia, Bulgaria" },
  { badge: "Diploma", degree: "College Diploma in Business Administration", school: "The College of Northwest London, Sofia branch" },
];

export const publication = {
  label: "Published book",
  title: "Automated Systems in Internet Business Models",
  meta: ["Boril Bogoev, Ph.D. · First Edition", "Foundation \"Scientific Research,\" Sofia, 2010", "209 pages, softcover, with diagrams and illustrations"],
};

export const teaching = {
  label: "Academic teaching",
  title: "Courses & lectures",
  items: [
    "New Bulgarian University: Digital Marketing",
    "SoftUni: Marketing & Business courses",
    "Corporate AI workshops and training programs",
    "Modular learning paths for executives and founders",
    "10,000+ professionals reached through training",
  ],
};

export const languages = [
  { name: "Bulgarian", level: "Native" },
  { name: "English", level: "Fluent" },
  { name: "Russian", level: "Beginner" },
];

export const industries = [
  "FinTech", "E-commerce", "EdTech", "HealthTech", "Real Estate", "Fashion & Luxury Retail", "F&B", "Interior Design",
  "Telecom", "Professional Services", "SaaS & Marketplaces", "Banking & Government", "SMEs & Startups",
];

export const aboutNav = [
  { id: "profile", label: "Profile" },
  { id: "experience", label: "Experience" },
  { id: "skills", label: "Skills" },
  { id: "education", label: "Education" },
  { id: "publications", label: "Publications" },
  { id: "contact", label: "Contact" },
];
