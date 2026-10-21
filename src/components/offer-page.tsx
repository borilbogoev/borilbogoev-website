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

/** "12 PM" becomes "12:00 PM"; any other format is shown as written. */
function clock(time: string) {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i.exec(time.trim());
  return m ? `${m[1]}:${m[2] ?? "00"} ${m[3].toUpperCase()}` : time;
}

/** A large six-spoke asterisk, the brand's graphic device, drawn in outline. */
function AsteriskMark() {
  return (
    <svg aria-hidden viewBox="-50 -50 100 100" className="pointer-events-none absolute -bottom-16 -right-12 h-[300px] w-[300px] md:-bottom-24 md:-right-16 md:h-[420px] md:w-[420px]" fill="none" stroke="var(--on-inverse-line)" strokeWidth="9" strokeLinecap="round">
      <path d="M0 -42V42M-36.4 -21L36.4 21M-36.4 21L36.4 -21" />
    </svg>
  );
}

/**
 * Feature hero for the next live event: a dark card on a white band, above the default hero.
 * Brand: one dark ground, one red primary button, a red full stop and bullet dots, mono for the time.
 * Reusable for any urgent or featured announcement.
 */
function UpcomingEvent({ event }: { event: NonNullable<Offer["upcoming"]> }) {
  const title = event.title.replace(/\.$/, "");
  return (
    <section aria-label={event.label} className="w-full border-b border-line bg-surface pb-10 pt-8 md:pb-14 md:pt-12">
      <div className="container-bb">
        <div
          className="relative grid overflow-hidden rounded-[14px] md:grid-cols-[minmax(0,320px)_1fr]"
          style={{ background: "var(--surface-inverse)", color: "var(--on-inverse)", boxShadow: "var(--shadow)" }}
        >
          <AsteriskMark />

          {/* Date and time frame */}
          <time
            dateTime={event.iso}
            className="relative flex flex-col justify-center gap-6 border-b p-6 md:border-b-0 md:border-r md:p-9"
            style={{ borderColor: "var(--on-inverse-line)" }}
          >
            <span className="flex items-end gap-5 md:block">
              <span className="block font-extrabold leading-[0.85] tracking-[-0.03em]" style={{ fontSize: "clamp(88px, 14vw, 132px)" }}>
                {event.day}
                <span className="text-brand">.</span>
              </span>
              <span className="block pb-1 md:mt-5 md:pb-0">
                <span className="block text-[13px] font-bold uppercase leading-[1.4] tracking-[0.14em]" style={{ color: "var(--on-inverse-accent)" }}>
                  {event.weekday}
                </span>
                <span className="mt-1 block text-[20px] font-bold leading-[1.3]">
                  {event.month} {event.year}
                </span>
              </span>
            </span>
            <span className="block border-t pt-5" style={{ borderColor: "var(--on-inverse-line)" }}>
              <span className="block font-mono text-[26px] font-medium leading-none">{clock(event.time)}</span>
              <span className="mt-2 block font-mono text-[11px] font-medium uppercase tracking-[0.04em]" style={{ color: "var(--on-inverse-muted)" }}>
                {event.zone}
              </span>
            </span>
          </time>

          {/* Announcement */}
          <div className="relative p-6 md:p-9 lg:p-11">
            {event.image && (
              <img
                src={event.image.src}
                width={event.image.width}
                height={event.image.height}
                alt={event.image.alt}
                className="mb-6 h-auto w-full rounded-[8px]"
                decoding="async"
              />
            )}
            <p className="m-0 text-[13px] font-bold uppercase leading-[1.4] tracking-[0.14em]" style={{ color: "var(--on-inverse-accent)" }}>
              {event.label}
            </p>
            <h2 className="mt-3 max-w-[22ch] font-extrabold leading-[1.15] tracking-[-0.02em]" style={{ fontSize: "clamp(28px, 3.5vw, 44px)" }}>
              {title}
              <span className="text-brand">.</span>
            </h2>
            {event.subtitle && (
              <p className="mt-4 max-w-[40ch] font-light leading-[1.3] tracking-[-0.01em]" style={{ fontSize: "clamp(18px, 2vw, 22px)", color: "var(--on-inverse-muted)" }}>
                {event.subtitle}
              </p>
            )}
            {event.text && (
              <p className="mt-5 max-w-[52ch] text-[16px] leading-[1.65]" style={{ color: "var(--on-inverse)" }}>
                {event.text}
              </p>
            )}
            {event.bullets && event.bullets.length > 0 && (
              <ul className="m-0 mt-5 grid list-none gap-2.5 p-0">
                {event.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-3 text-[14px] leading-[1.6]">
                    <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={event.signupUrl} target="_blank" rel="noopener noreferrer" className="bb-btn bb-btn-primary">
                {event.signupLabel}
              </a>
              {event.secondary && (
                <a href={event.secondary.href} className="bb-btn bb-btn-inverse">
                  {event.secondary.label}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
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
      {offer.upcoming && <UpcomingEvent event={offer.upcoming} />}

      {/* Default hero */}
      <section id="offer-hero" className={`section hero-soft pb-12 pt-12 md:pb-20 md:pt-20`}>
        <div className="container-bb">
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
          <dl className="m-0 mt-10 grid gap-5 border-t border-line pt-6 sm:grid-cols-3">
            {offer.facts.map((f) => (
              <div key={f.label}>
                <dt className="label text-muted">{f.label}</dt>
                <dd className="m-0 mt-1 text-[17px] font-bold leading-snug">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Problem */}
      <Section eyebrow="Problem" heading="The problem">
        <p className="max-w-[62ch] text-[18px] font-medium leading-[1.7] md:text-[20px]">{offer.problem}</p>
      </Section>

      {/* Audience */}
      <Section alt eyebrow="Audience" heading="Who it is for">
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
      <Section eyebrow="Outcome" heading="What you get">
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
      <Section alt eyebrow="Process" heading="How it works">
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
      <Section id="plans" eyebrow="Pricing" heading={plans.heading} intro={plans.intro}>
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
