import { home } from "@/content/home";
import { education, jobs, profile, publication, resumeHero, skillGroups, stats } from "@/content/resume";
import { founderBio, site } from "@/content/site";
import { abs } from "./seo";

const plain = (s: string) => s.replace(/\*\*/g, "");

/** The short index for AI assistants (llmstxt.org). */
export function llmsIndex() {
  return [
    `# ${site.fullName}`,
    "",
    `> ${site.description}`,
    "",
    `${site.positioning} ${site.tagline} Based in ${site.location}. Prices are in AED.`,
    "",
    "## Offers",
    ...home.offers.map((o) => `- [${o.name}](${abs(`/l/${o.slug}`)}): ${o.summary} ${o.from}, ${o.note.toLowerCase()}.`),
    "",
    "## About",
    `- [Resume and experience](${abs("/about")}): ${resumeHero.description}`,
    `- [Contact](${abs("/contact")}): Send an inquiry. Replies are personal.`,
    "",
    "## Full text",
    `- [All pages as one Markdown file](${abs("/llms-full.txt")})`,
    "",
  ].join("\n");
}

function offerMarkdown(o: (typeof home.offers)[number]) {
  return [`## ${o.name}`, `URL: ${abs(`/l/${o.slug}`)}`, "", `${o.tag}. ${o.summary}`, "", `Price: ${o.from}. ${o.note}.`, ""].join("\n");
}

/** Every page of the site as one Markdown document. */
export function llmsFull() {
  const resume = [
    "## About",
    `URL: ${abs("/about")}`,
    "",
    `${site.fullName}, ${resumeHero.role}. ${resumeHero.description}`,
    "",
    `Numbers: ${stats.map((s) => `${s.value}+ ${s.label.toLowerCase()}`).join(", ")}.`,
    "",
    `### ${profile.heading}`,
    ...profile.paragraphs.map(plain),
    "",
    "### Professional experience",
    ...jobs.flatMap((j) => [
      `#### ${j.company}, ${j.role} (${j.period})`,
      j.place,
      ...(j.intro ? [j.intro] : []),
      ...j.bullets.map((b) => `- ${b}`),
      `Key results: ${j.results.join("; ")}.`,
      "",
    ]),
    "### Skills",
    ...skillGroups.map((g) => `- **${g.label}:** ${[...g.primary, ...g.secondary].join(", ")}`),
    "",
    "### Education",
    ...education.map((e) => `- ${e.degree}, ${e.school}`),
    "",
    "### Publication",
    `${publication.title}. ${publication.meta.join(" ")}`,
    "",
    "### Who runs the offers",
    founderBio,
    "",
  ];
  return [`# ${site.fullName}`, "", `> ${site.description}`, "", ...home.offers.map(offerMarkdown), ...resume].join("\n");
}
