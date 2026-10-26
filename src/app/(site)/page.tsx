import Link from "next/link";
import { ArrowRightIcon, LocationIcon } from "@/components/icons";
import { JsonLd } from "@/components/json-ld";
import { UpcomingEvent } from "@/components/offer-page";
import { StatsBand } from "@/components/stats-band";
import { Section } from "@/components/ui";
import { home } from "@/content/home";
import { resumeHero } from "@/content/resume";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = {
  ...pageMetadata({
    title: `${site.name}, Ph.D. | AI and automation: ${site.positioning}`,
    description: site.description,
    path: "/",
  }),
  title: { absolute: `${site.name}, Ph.D. | AI and automation: ${site.positioning}` },
};

export default function HomePage() {
  return (
    <>
      {home.upcoming && <UpcomingEvent event={home.upcoming} />}

      <section className="section hero-soft pb-14 pt-12 md:pb-24 md:pt-20">
        <div className="container-bb grid items-center gap-12 lg:grid-cols-[1fr_auto] lg:gap-16">
          <div>
            <p className="badge label">{home.badge}</p>
            <h1 className="t-display-xl mt-6">
              {home.headline}
              <span className="accent">.</span>
            </h1>
            <p className="t-overline mt-6">{resumeHero.role}</p>
            <p className="t-body-lg mt-5 max-w-[56ch]">{home.lead}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/l/ai-jump#book" className="bb-btn bb-btn-primary">
                Book My Jump
              </Link>
              <Link href="/about" className="bb-btn bb-btn-outline">
                About Boril
              </Link>
            </div>
            <p className="t-body-sm mt-6 flex items-center gap-1.5 text-muted">
              <LocationIcon size={14} />
              {site.location}
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

      <StatsBand />

      <Section id="path" eyebrow="Work with me" heading={home.ladderHeading} intro={home.ladderIntro}>
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3 md:gap-6">
          {home.offers.map((o, i) => (
            <li key={o.slug}>
              <Link href={`/l/${o.slug}`} className="card flex h-full flex-col gap-3 no-underline">
                <img src={o.image} width={1200} height={900} alt={o.alt} loading="lazy" decoding="async" className="mb-1 h-auto w-full rounded-[var(--radius-sm)]" />
                <p className="t-mono text-brand-text">
                  {String(i + 1).padStart(2, "0")} · {o.tag}
                </p>
                <h3 className="t-h2">{o.name}</h3>
                <p className="t-body-sm m-0 text-muted">{o.summary}</p>
                <p className="mt-auto flex items-center justify-between gap-3 pt-2 text-[14px] font-semibold">
                  <span>
                    {o.from}
                    <span className="t-caption block font-normal text-muted">{o.note}</span>
                  </span>
                  <ArrowRightIcon size={18} className="shrink-0 text-brand" />
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section alt eyebrow="Next step" heading={home.closing.heading}>
        <div className="grid items-start gap-6 md:grid-cols-[1fr_auto] md:gap-12">
          <p className="t-body-lg max-w-[56ch]">{home.closing.text}</p>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
            <Link href="/l/ai-jump#book" className="bb-btn bb-btn-dark">
              Book My Jump
            </Link>
            <a href={site.linkedin} target="_blank" rel="noopener" className="bb-btn bb-btn-outline">
              LinkedIn Profile
            </a>
          </div>
        </div>
      </Section>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", url: site.url, name: `${site.name}: AI and automation`, isPartOf: { "@id": `${site.url}/#website` } }} />
    </>
  );
}
