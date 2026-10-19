import type { MetadataRoute } from "next";
import { offers } from "@/content/offers";
import { abs } from "@/lib/seo";

// Update `lastModified` when a page's content changes. Add new modules here as they are built.
const updated = new Date("2026-10-19");

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "/", priority: 1 },
    ...offers.map((o) => ({ path: `/${o.slug}`, priority: 0.9 })),
    { path: "/about", priority: 0.8 },
    { path: "/contact", priority: 0.5 },
  ];
  return pages.map((p) => ({ url: abs(p.path), lastModified: updated, changeFrequency: "monthly", priority: p.priority }));
}
