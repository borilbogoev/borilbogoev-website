import Link from "next/link";
import { ArrowRightIcon, LocationIcon, LinkedinIcon, icons } from "@/components/icons";
import { JsonLd } from "@/components/json-ld";
import { SectionNav } from "@/components/section-nav";
import { StatsBand } from "@/components/stats-band";
import { Tabs } from "@/components/tabs";
import { RichText, Section } from "@/components/ui";
import {
  aboutNav,
  education,
  industries,
  jobs,
  languages,
  profile,
  publication,
  resumeHero,
  skillGroups,
  teaching,
  tools,
} from "@/content/resume";
import { site } from "@/content/site";
import { breadcrumbLd, pageMetadata, profilePageLd } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "About Boril Bogoev, Ph.D.: resume, experience and skills",
  description:
    "Boril Bogoev, Ph.D., Head of AI & Automation. 20+ years across SaaS, healthcare, retail, fintech and enterprise: workflow orchestration, AI adoption and digital operating systems. Based in Dubai.",
  path: "/about",
});

const AiBrand = () => (
  <>
    <span className="accent">AI</span>UGMENTIC
  </>
);

export default function AboutPage() {
  return (
    <>
      <section id="top" className="section pb-12 pt-12 md:pb-20 md:pt-20">
        <div className="container-bb grid items-center gap-12 lg:grid-cols-[1fr_auto] lg:gap-16">
          <div>
            <p className="badge label">{resumeHero.badge}</p>
            <h1 className="t-display-xl mt-6">
              {resumeHero.name[0]}
              <br />
              {resumeHero.name[1]}
              <span className="accent">.</span>
            </h1>
            <p className="t-subtitle mt-2">{resumeHero.credential}</p>
            <p className="t-overline mt-5">{resumeHero.role}</p>
            <p className="t-body-lg mt-6 max-w-[56ch]">{resumeHero.description}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#experience" className="bb-btn bb-btn-primary">
                View Experience
              </a>
              <a href={site.linkedin} target="_blank" rel="noopener" className="bb-btn bb-btn-outline">
                LinkedIn Profile
              </a>
            </div>
            <p className="t-body-sm mt-6 flex items-center gap-1.5 text-muted">
              <LocationIcon size={14} />
              {resumeHero.location}
            </p>
          </div>
          <div className="portrait mx-auto h-[200px] w-[200px] lg:h-[260px] lg:w-[260px]">
            <img
              src="/brand/portrait-320.webp"
              srcSet="/brand/portrait-320.webp 320w, /brand/portrait-640.webp 640w"
              sizes="(min-width: 1024px) 260px, 200px"
              width={260}
              height={260}
              alt={`${site.fullName}, portrait illustration`}
              fetchPriority="high"
              decoding="async"
            />
          </div>
        </div>
      </section>

      <SectionNav items={aboutNav} />
      <StatsBand />

      <Section id="profile" eyebrow="Profile" heading={profile.heading}>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="grid gap-5">
            {profile.paragraphs.map((p) => (
              <p key={p} className="t-body-lg m-0">
                <RichText text={p} />
              </p>
            ))}
          </div>
          <ul className="m-0 grid list-none content-start gap-4 p-0">
            {profile.cards.map((c) => {
              const Icon = icons[c.icon];
              return (
                <li key={c.title} className="card" style={{ background: "var(--surface-alt)" }}>
                  <span className="icon-well">
                    <Icon size={18} />
                  </span>
                  <h3 className="t-h4 mt-3">{c.title}</h3>
                  <p className="t-caption mt-1 text-muted">{c.text}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </Section>

      <Section id="experience" alt eyebrow="Career" heading="Professional experience">
        <Tabs
          label="Professional experience"
          tabs={jobs.map((j) => ({ id: `job-${j.id}`, label: j.aiBrand ? <AiBrandLabel /> : j.tab }))}
          panels={jobs.map((j) => (
            <article key={j.id} className="card card-raised md:p-8">
              <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="t-h2" style={{ color: "var(--brand-text)" }}>
                    {j.aiBrand ? <AiBrand /> : j.company}
                  </h3>
                  <p className="mt-0.5 text-[15px] font-semibold">{j.role}</p>
                  <p className="t-caption mt-1 text-muted">{j.place}</p>
                </div>
                <span className="t-meta whitespace-nowrap rounded-full border border-line bg-surface-alt px-3.5 py-1.5 text-muted">{j.period}</span>
              </header>
              {j.intro && <p className="t-body-sm mb-5 italic text-muted">{j.intro}</p>}
              <ul className="dot-list mb-6">
                {j.bullets.map((b) => (
                  <li key={b} className="t-body-sm">
                    {b}
                  </li>
                ))}
              </ul>
              <div className="rounded-[8px] bg-surface-alt p-5">
                <p className="label mb-3 text-brand-text">Key results</p>
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                  {j.results.map((r) => (
                    <li key={r} className="rounded-full border border-line bg-surface px-3.5 py-1 text-[13px] font-semibold">
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        />
      </Section>

      <Section id="skills" eyebrow="Expertise" heading="Core skills & tools">
        <Tabs
          variant="pill"
          label="Skills"
          tabs={skillGroups.map((g) => ({ id: `skill-${g.id}`, label: g.label }))}
          panels={skillGroups.map((g) => (
            <ul key={g.id} className="m-0 flex list-none flex-wrap gap-2 p-0">
              {g.primary.map((s) => (
                <li key={s} className="tag tag-red">
                  {s}
                </li>
              ))}
              {g.secondary.map((s) => (
                <li key={s} className="tag">
                  {s}
                </li>
              ))}
            </ul>
          ))}
        />
        <div className="mt-12">
          <h3 className="label mb-4 text-muted">Tools & platforms</h3>
          <div className="marquee">
            <div className="marquee-track">
              <ul className="m-0 flex list-none gap-3.5 p-0">
                {tools.map((t) => (
                  <li key={t} className="chip">
                    {t}
                  </li>
                ))}
              </ul>
              <ul className="m-0 flex list-none gap-3.5 p-0" aria-hidden="true">
                {tools.map((t) => (
                  <li key={t} className="chip">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      <Section id="education" alt eyebrow="Academic background" heading="Education">
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3 md:gap-6">
          {education.map((e) => (
            <li key={e.degree} className="card">
              <span className="badge label mb-4 !gap-0 before:hidden">{e.badge}</span>
              <h3 className="t-h3">{e.degree}</h3>
              <p className="t-caption mt-2 text-muted">{e.school}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="publications" eyebrow="Knowledge & teaching" heading="Publications & academic work">
        <div className="grid gap-4 md:grid-cols-2 md:gap-7">
          <div className="rounded-[14px] p-8" style={{ background: "var(--surface-inverse)", color: "var(--on-inverse)" }}>
            <p className="label" style={{ color: "var(--on-inverse-accent)" }}>
              {publication.label}
            </p>
            <h3 className="t-h3 mt-3.5">{publication.title}</h3>
            <p className="t-caption mt-2.5 leading-[1.7]" style={{ color: "var(--on-inverse-muted)" }}>
              {publication.meta.map((m) => (
                <span key={m} className="block">
                  {m}
                </span>
              ))}
            </p>
          </div>
          <div className="card p-8" style={{ background: "var(--surface-alt)" }}>
            <p className="label text-brand-text">{teaching.label}</p>
            <h3 className="t-h3 mt-3.5">{teaching.title}</h3>
            <ul className="mt-3 m-0 list-none p-0">
              {teaching.items.map((item) => (
                <li key={item} className="t-body-sm flex items-center gap-2.5 border-b border-line py-2 text-muted last:border-0">
                  <span aria-hidden className="h-[5px] w-[5px] flex-none rounded-full bg-brand" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12">
          <h3 className="eyebrow mb-4">Languages</h3>
          <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
            {languages.map((l) => (
              <li key={l.name} className="card min-w-[140px] !px-5 !py-4">
                <p className="t-h4">{l.name}</p>
                <p className="t-meta mt-0.5 font-normal text-muted">{l.level}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-12">
          <h3 className="eyebrow mb-4">Industries</h3>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {industries.map((i) => (
              <li key={i} className="tag">
                {i}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <section id="contact" className="section" style={{ background: "var(--surface-inverse)", color: "var(--on-inverse)" }}>
        <div className="container-bb grid items-center gap-10 md:grid-cols-[1fr_auto] md:gap-16">
          <div>
            <p className="eyebrow" style={{ color: "var(--on-inverse-accent)" }}>
              Get in touch
            </p>
            <h2 className="t-display-lg mt-2.5">
              Let&apos;s work
              <br />
              together<span className="accent">.</span>
            </h2>
            <p className="mt-4 max-w-[44ch] text-[16px] leading-[1.65]" style={{ color: "var(--on-inverse-muted)" }}>
              Open to senior AI and automation leadership roles, consulting engagements, and corporate training programs. Based in Dubai, available globally.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:min-w-[240px]">
            <a href={site.linkedin} target="_blank" rel="noopener" className="bb-btn bb-btn-primary">
              <LinkedinIcon size={16} /> LinkedIn
            </a>
            <Link href="/contact" className="inline-flex min-h-[44px] items-center justify-center gap-2 text-[14px] font-semibold hover:underline">
              Send an inquiry <ArrowRightIcon size={16} />
            </Link>
          </div>
        </div>
      </section>

      <JsonLd
        data={[
          profilePageLd(),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
        ]}
      />
    </>
  );
}

function AiBrandLabel() {
  return (
    <span className="font-extrabold">
      <AiBrand />
    </span>
  );
}
