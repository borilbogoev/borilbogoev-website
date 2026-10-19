import { home } from "@/content/home";
import { offers } from "@/content/offers";
import { education, jobs, profile, publication, resumeHero, skillGroups, stats } from "@/content/resume";
import { founderBio, site } from "@/content/site";
import type { Offer } from "@/content/types";
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
    ...offers.map((o) => `- [${o.eyebrow}](${abs(`/${o.slug}`)}): ${o.card.summary} ${o.card.from}.`),
    `- [The Streamliner](${site.streamliner}): ${home.streamlinerLine}`,
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

function offerMarkdown(o: Offer) {
  const { plans } = o;
  const lines = [
    `## ${o.eyebrow}`,
    `URL: ${abs(`/${o.slug}`)}`,
    "",
    `**${o.headline}**`,
    "",
    o.tagline,
    "",
    ...o.lead,
    "",
    "### The problem",
    o.problem,
    "",
    "### Who it is for",
    ...o.audience.map((a) => `- ${a}`),
    "",
    "### What you get",
    ...o.gets.map((a) => `- ${a}`),
    "",
    "### How it works",
    ...o.steps.map((s, i) => `${i + 1}. **${s.title}.** ${s.text}`),
    "",
    `### ${plans.heading}`,
    plans.intro,
    "",
    ...plans.plans.map((p) => `- **${p.name}**${p.sub ? ` (${p.sub})` : ""}: ${p.price}${p.priceNote ? `, ${p.priceNote}` : ""}`),
  ];
  if (plans.rows.length) {
    lines.push("");
    for (const row of plans.rows) {
      const cells = row.values.map((v, i) => `${plans.plans[i].name}: ${v === true ? "yes" : v === false ? "no" : v}`);
      lines.push(`- ${row.feature}: ${cells.join("; ")}`);
    }
  }
  if (plans.included) lines.push("", `${plans.included.heading}:`, ...plans.included.items.map((i) => `- ${i}`));
  lines.push("", `### ${o.notHeading}`, ...o.notItems.map((a) => `- ${a}`), "", "### Questions", ...o.faq.flatMap((f) => [`**${f.q}**`, f.a, ""]));
  return lines.join("\n");
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
  return [`# ${site.fullName}`, "", `> ${site.description}`, "", ...offers.map(offerMarkdown), ...resume].join("\n");
}
