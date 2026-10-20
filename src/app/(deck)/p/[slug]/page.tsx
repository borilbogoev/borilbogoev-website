import { cache } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { db } from "@/db/use";
import { JsonLd } from "@/components/json-ld";
import { site } from "@/content/site";
import { abs, indexable } from "@/lib/seo";
import { DeckView } from "@/modules/presentations/components/deck";
import { DeckMount, ProtectedDeck } from "@/modules/presentations/components/deck-client";
import { getDeckBySlug, getTree } from "@/modules/presentations/lib/presentations";

// A presentation at /p/<slug>. Static and cached like the rest of the site; saving or activating a deck refreshes it at once
// (revalidatePath), and the time below is the safety net for edits made outside the admin.
// A password-protected deck is a static lock screen: the slides are fetched only after the right password.
export const revalidate = 300;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

const load = cache((slug: string) => getDeckBySlug(decodeURIComponent(slug)));

export async function generateStaticParams() {
  try {
    const rows = await db().select({ slug: schema.presentations.slug }).from(schema.presentations).where(eq(schema.presentations.status, "active"));
    return rows.map((r) => ({ slug: r.slug }));
  } catch {
    return []; // no database at build time: decks are built on first visit
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const deck = await load(slug);
  if (!deck || deck.status === "draft" || deck.status === "archived") return { title: "Not found", robots: { index: false, follow: false } };
  const s = deck.settings;
  const title = s.seo_title || deck.title;
  const url = `${site.url}/p/${deck.slug}`;
  const open = deck.status === "active" && !deck.passwordHash;
  return {
    title: { absolute: `${title} | ${site.name}` },
    description: open ? s.seo_description || undefined : undefined,
    alternates: { canonical: url },
    robots: open && s.indexable && indexable ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } } : { index: false, follow: false },
    openGraph: open ? { type: "website", url, title, description: s.seo_description || undefined, siteName: site.name, images: s.og_image ? [{ url: s.og_image }] : undefined } : undefined,
    twitter: open ? { card: "summary_large_image", title, description: s.seo_description || undefined, images: s.og_image ? [s.og_image] : undefined } : undefined,
  };
}

export default async function DeckRoute({ params }: Props) {
  const { slug } = await params;
  const deck = await load(slug);
  if (!deck) notFound();
  if (deck.status === "draft" || deck.status === "archived") {
    if (deck.settings.closed_redirect) redirect(deck.settings.closed_redirect);
    notFound();
  }
  if (deck.status === "inactive") {
    return (
      <main className="pr-lock">
        <div className="pr-lock__box">
          <p className="pr-eyebrow">Presentation</p>
          <h1>
            Not available right now<span className="pr-dot">.</span>
          </h1>
          <p className="pr-sub">{deck.settings.closed_message || "This presentation is switched off. Ask the sender for a new link."}</p>
        </div>
      </main>
    );
  }
  if (deck.passwordHash) return <ProtectedDeck slug={deck.slug} title={deck.title} subtitle={deck.settings.subtitle} />;

  const slides = await getTree(deck.id);
  const url = abs(`/p/${deck.slug}`);
  return (
    <>
      <DeckView deck={deck} slides={slides} track />
      <DeckMount />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "PresentationDigitalDocument",
          "@id": `${url}#presentation`,
          url,
          name: deck.settings.seo_title || deck.title,
          description: deck.settings.seo_description || undefined,
          inLanguage: deck.settings.lang,
          author: { "@id": `${site.url}/#person` },
          numberOfPages: slides.filter((s) => !s.settings.hidden).length,
        }}
      />
    </>
  );
}
