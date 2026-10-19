import type { Metadata } from "next";
import { site } from "@/content/site";
import type { Faq, Offer } from "@/content/types";

/** Search engines may index the site only after launch: set SITE_INDEXABLE=true in Vercel production. */
export const indexable = process.env.SITE_INDEXABLE === "true";

export const abs = (path: string) => new URL(path, site.url).toString();

/** Metadata for one page: title, description, canonical URL, Open Graph and Twitter cards. */
export function pageMetadata(opts: { title: string; description: string; path: string }): Metadata {
  const url = abs(opts.path);
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title: opts.title, description: opts.description, siteName: site.name, locale: "en_US" },
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description },
  };
}

const personId = `${site.url}/#person`;
const websiteId = `${site.url}/#website`;

export function personLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": personId,
    name: site.name,
    honorificSuffix: "Ph.D.",
    jobTitle: site.jobTitle,
    description: site.description,
    url: site.url,
    image: abs("/brand/portrait-640.webp"),
    address: { "@type": "PostalAddress", addressLocality: "Dubai", addressCountry: "AE" },
    sameAs: [site.linkedin, site.streamliner],
    worksFor: { "@type": "Organization", name: site.founderOf },
    alumniOf: [
      { "@type": "CollegeOrUniversity", name: "University of Library Studies and Information Technologies" },
      { "@type": "CollegeOrUniversity", name: "Technical University of Sofia" },
    ],
    knowsAbout: [
      "Artificial intelligence",
      "Workflow automation",
      "AI agents",
      "Business process automation",
      "AI adoption",
      "Marketing operations",
      "Digital operating systems",
    ],
    knowsLanguage: ["bg", "en", "ru"],
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteId,
    url: site.url,
    name: site.name,
    description: site.description,
    inLanguage: "en",
    publisher: { "@id": personId },
  };
}

export function profilePageLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${site.url}/about#profile`,
    url: abs("/about"),
    name: `About ${site.name}`,
    inLanguage: "en",
    isPartOf: { "@id": websiteId },
    mainEntity: { "@id": personId },
  };
}

export function offerLd(offer: Offer) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${site.url}/${offer.slug}#service`,
    name: `${site.name}: ${offer.eyebrow}`,
    serviceType: offer.serviceType,
    description: offer.metaDescription,
    url: abs(`/${offer.slug}`),
    provider: { "@id": personId },
    areaServed: "Worldwide",
    audience: { "@type": "Audience", audienceType: "Executives and business owners" },
    offers: offer.plans.plans.map((plan, i) => ({
      "@type": "Offer",
      name: plan.name,
      price: offer.plans.prices[i],
      priceCurrency: offer.plans.currency,
      url: abs(`/${offer.slug}#plans`),
      availability: "https://schema.org/InStock",
    })),
  };
}

export function faqLd(faq: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: abs(item.path) })),
  };
}
