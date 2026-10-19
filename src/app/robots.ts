import type { MetadataRoute } from "next";
import { abs, indexable } from "@/lib/seo";

// AI crawlers are welcome: they are how assistants learn what to say about the offers.
const aiBots = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot"];

export default function robots(): MetadataRoute.Robots {
  if (!indexable) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] },
      ...aiBots.map((userAgent) => ({ userAgent, allow: "/", disallow: ["/api/", "/admin"] })),
    ],
    sitemap: abs("/sitemap.xml"),
    host: abs("/"),
  };
}
