import type { MetadataRoute } from "next";
import { offers } from "@/content/offers";
import { abs } from "@/lib/seo";
import { indexablePages } from "@/modules/landing/lib/pages";

// Update `lastModified` when a page's content changes. Add new modules here as they are built.
const updated = new Date("2026-10-19");

// Landing pages that allow search engines join the list; the sitemap is rebuilt every hour.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = [
    { path: "/", priority: 1 },
    ...offers.map((o) => ({ path: `/${o.slug}`, priority: 0.9 })),
    { path: "/about", priority: 0.8 },
    { path: "/contact", priority: 0.5 },
  ];
  const entries: MetadataRoute.Sitemap = pages.map((p) => ({ url: abs(p.path), lastModified: updated, changeFrequency: "monthly", priority: p.priority }));
  try {
    for (const l of await indexablePages()) entries.push({ url: abs(`/l/${l.slug}`), lastModified: l.updatedAt, changeFrequency: "monthly", priority: 0.6 });
  } catch {
    // no database (a build without DATABASE_URL): the fixed pages are enough
  }
  return entries;
}
