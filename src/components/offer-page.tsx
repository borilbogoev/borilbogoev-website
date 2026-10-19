import { offers } from "@/content/offers";
import { FormEmbed } from "@/modules/forms";
import type { Offer } from "@/content/types";
import { breadcrumbLd, faqLd, offerLd } from "@/lib/seo";
import { Faq } from "./faq";
import { FounderBand } from "./founder-band";
import { CheckIcon, MinusIcon, UsersIcon } from "./icons";
import { JsonLd } from "./json-ld";
import { PlanCards, PlanTable } from "./plans";
import { StickyCta } from "./sticky-cta";
import { Section } from "./ui";

/** The next live event: a dark card with the date, title, time and one red sign-up button. */
function UpcomingEvent({ event }: { event: NonNullable<Offer["upcoming"]> }) {
  return (
    <section
      aria-label={event.label}
      className="relative overflow-hidden rounded-[14px] p-6 md:p-7"
      style={{ background: "var(--surface-inverse)", color: "var(--on-inverse)", boxShadow: "var(--shadow)" }}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: "var(--brand)" }} />
      <p className="label" style={{ color: "var(--on-inverse-accent)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
        {event.label}
      </p>
      <time dateTime={event.iso} className="mt-4 flex items-end gap-3">
        <span className="t-stat leading-none" style={{ fontSize: "clamp(56px, 8vw, 72px)" }}>
          {event.day}
        </span>
        <span className="pb-1.5 leading-tight">
          <span className="block text-[17px] font-bold">
            {event.month} {event.year}
          </span>
          <span className="block text-[14px]" style={{ color: "var(--on-inverse-muted)" }}>
            {event.weekday}
          </span>
        </span>
      </time>
      <h2 className="mt-5 text-[20px] font-extrabold leading-[1.25] tracking-tight">{event.title}</h2>
      <p className="mt-4 border-t pt-4 text-[15px] font-semibold leading-snug" style={{ borderColor: "var(--on-inverse-line)" }}>
        {event.time}
        <span className="block font-normal" style={{ color: "var(--on-inverse-muted)" }}>
          {event.zone}
        </span>
      </p>
      <a href={event.signupUrl} className="bb-btn bb-btn-primary mt-6 w-full">
        {event.signupLabel}
      </a>
    </section>
  );
}

/** One landing page per offer, built from a content file in src/content/offers. */
export function OfferPage({ offer }: { offer: Offer }) {
  const { plans } = offer;
  const index = offers.findIndex((o) => o.slug === offer.slug);
  const next = offers[index + 1];

  return (
    <>
      {/* Hero */}
      <section id="offer-hero" className="section pb-12 pt-12 md:pb-20 md:pt-20">
        <div className="container-bb grid gap-10 lg:grid-cols-[1fr_340px] lg:gap-16">
          <div>
            <p className="eyebrow">{offer.eyebrow}</p>
            <h1 className="t-display-lg mt-3 max-w-[20ch]">
              {offer.headline.replace(/\.$/, "")}
              <span className="accent">.</span>
            </h1>
            <p className="t-subtitle mt-5 max-w-[52ch]">{offer.tagline}</p>
            {offer.lead.map((p) => (
              <p key={p} className="t-body-lg mt-5 max-w-[58ch]">
                {p}
              </p>
            ))}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#inquiry" className={`bb-btn ${offer.upcoming ? "bb-btn-outline border-brand" : "bb-btn-primary"}`}>
                Send an Inquiry
              </a>
              <a href="#plans" className="bb-btn bb-btn-outline">
                See Pricing
              </a>
            </div>
          </div>
          <aside className="grid content-start gap-5 self-start">
            {offer.upcoming && <UpcomingEvent event={offer.upcoming} />}
            <dl className="card card-raised m-0 grid content-start gap-5">
              {offer.facts.map((f) => (
                <div key={f.label}>
                  <dt className="label text-muted">{f.label}</dt>
                  <dd className="m-0 mt-1 text-[17px] font-bold leading-snug">{f.value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>

      {/* Problem */}
      <Section alt eyebrow="Problem" heading="The problem">
        <p className="max-w-[62ch] text-[18px] font-medium leading-[1.7] md:text-[20px]">{offer.problem}</p>
      </Section>

      {/* Audience */}
      <Section eyebrow="Audience" heading="Who it is for">
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3 md:gap-6">
          {offer.audience.map((line) => (
            <li key={line} className="card flex flex-col gap-4">
              <span className="icon-well">
                <UsersIcon size={18} />
              </span>
              <p className="t-body-sm m-0 text-[15px] leading-[1.6]">{line}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* What you get */}
      <Section alt eyebrow="Outcome" heading="What you get">
        <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2 md:gap-4">
          {offer.gets.map((line) => (
            <li key={line} className="flex items-start gap-3 rounded-[14px] border border-line bg-surface p-4">
              <span className="icon-well">
                <CheckIcon size={18} />
              </span>
              <span className="pt-1 text-[15px] leading-[1.55]">{line}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* How it works */}
      <Section eyebrow="Process" heading="How it works">
        <ol className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 md:gap-6 lg:grid-cols-[repeat(var(--steps),1fr)]" style={{ ["--steps" as string]: offer.steps.length >= 5 ? 3 : offer.steps.length }}>
          {offer.steps.map((step, i) => (
            <li key={step.title} className="card">
              <p className="t-mono text-brand-text">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="t-h3 mt-3">{step.title}</h3>
              <p className="t-body-sm mt-2 text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Plans */}
      <Section id="plans" alt eyebrow="Pricing" heading={plans.heading} intro={plans.intro}>
        {plans.rows.length > 0 ? <PlanTable plans={plans.plans} rows={plans.rows} label={plans.heading} /> : <PlanCards plans={plans.plans} />}
        {plans.included && (
          <div className="mt-10">
            <h3 className="t-h3 mb-4">{plans.included.heading}</h3>
            <ul className="m-0 grid list-none gap-x-8 gap-y-1 p-0 md:grid-cols-2">
              {plans.included.items.map((item) => (
                <li key={item} className="flex items-start gap-3 border-b border-line py-3">
                  <span className="mt-0.5 text-brand">
                    <CheckIcon size={18} />
                  </span>
                  <span className="text-[15px] leading-[1.5]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <FounderBand />

      {/* What it is not */}
      <Section eyebrow="Boundaries" heading={offer.notHeading}>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 md:gap-4">
          {offer.notItems.map((line) => (
            <li key={line} className="flex items-center gap-3 rounded-[14px] border border-line p-4">
              <span className="text-muted">
                <MinusIcon size={18} />
              </span>
              <span className="text-[15px] font-medium">{line}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* FAQ */}
      <Section alt eyebrow="FAQ" heading="Questions">
        <Faq items={offer.faq} />
      </Section>

      {/* Inquiry */}
      <Section id="inquiry">
        <div className="mx-auto max-w-[760px]">
          <FormEmbed id={offer.inquiry.formId} theme="light" />
        </div>
        {next && (
          <p className="t-body-sm mt-10 text-muted">
            Next on the path: <a className="font-semibold text-ink underline decoration-brand underline-offset-4" href={`/${next.slug}`}>{next.eyebrow}</a>
          </p>
        )}
      </Section>

      <StickyCta />
      <JsonLd
        data={[
          offerLd(offer),
          faqLd(offer.faq),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: offer.name, path: `/${offer.slug}` },
          ]),
        ]}
      />
    </>
  );
}
