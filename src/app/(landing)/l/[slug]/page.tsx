import { cache } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { db } from "@/db/use";
import { site } from "@/content/site";
import { indexable } from "@/lib/seo";
import { LandingView } from "@/modules/landing/components/landing-view";
import { getBlocks, getPageBySlug } from "@/modules/landing/lib/pages";

// A landing page at /l/<slug>. Static and cached like the rest of the site; saving or publishing a page
// refreshes it at once (revalidatePath), and the time below is the safety net for edits made outside the admin.
export const revalidate = 300;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

const load = cache((slug: string) => getPageBySlug(decodeURIComponent(slug)));

export async function generateStaticParams() {
  try {
    const rows = await db().select({ slug: schema.landingPages.slug }).from(schema.landingPages).where(eq(schema.landingPages.status, "published"));
    return rows.map((r) => ({ slug: r.slug }));
  } catch {
    return []; // no database at build time: pages are built on first visit
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await load(slug);
  if (!page || page.status !== "published") return { title: "Page not found", robots: { index: false, follow: false } };
  const s = page.settings;
  const title = s.seo_title || page.title;
  const url = `${site.url}/l/${page.slug}`;
  return {
    title: { absolute: `${title} | ${site.name}` },
    description: s.seo_description || undefined,
    alternates: { canonical: url },
    robots: s.indexable && indexable ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } } : { index: false, follow: true },
    openGraph: { type: "website", url, title, description: s.seo_description || undefined, siteName: site.name, images: s.og_image ? [{ url: s.og_image }] : undefined },
    twitter: { card: "summary_large_image", title, description: s.seo_description || undefined, images: s.og_image ? [s.og_image] : undefined },
  };
}

export default async function LandingRoute({ params }: Props) {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) notFound();
  if (page.status !== "published") {
    if (page.settings.closed_redirect) redirect(page.settings.closed_redirect);
    notFound();
  }
  const blocks = await getBlocks(page.id);
  return <LandingView page={page} blocks={blocks} />;
}
