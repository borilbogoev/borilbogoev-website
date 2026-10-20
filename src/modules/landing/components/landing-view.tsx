import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { Monogram } from "@/components/monogram";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { site } from "@/content/site";
import { abs } from "@/lib/seo";
import type { LandingBlock } from "../lib/blocks";
import type { LandingPage } from "../lib/pages";
import { RenderBlock } from "./blocks";
import { StickyBar, Track } from "./client";
import "./landing.css";

const plain = (md: string) => md.replace(/[#*_`>]/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();

/**
 * One landing page, as visitors see it. A server component: the HTML is built once and cached,
 * so the page is as fast as a static file. `preview` turns the statistics off.
 */
export function LandingView({ page, blocks, preview = false }: { page: LandingPage; blocks: LandingBlock[]; preview?: boolean }) {
  const s = page.settings;
  const url = abs(`/l/${page.slug}`);
  const faq = blocks.filter((b) => b.type === "faq").flatMap((b) => b.settings.items as { q: string; a: string }[]).filter((i) => i.q && i.a);
  const ld: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${url}#page`,
      url,
      name: s.seo_title || page.title,
      description: s.seo_description || undefined,
      inLanguage: s.lang,
      isPartOf: { "@id": `${site.url}/#website` },
      author: { "@id": `${site.url}/#person` },
    },
  ];
  if (faq.length) ld.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: plain(f.a) } })) });

  return (
    <div className="lp" lang={s.lang}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {s.chrome === "full" ? (
        <SiteHeader />
      ) : s.chrome === "minimal" ? (
        <header className="lp-bar">
          <div className="lp-wrap">
            <Link href="/" aria-label={`${site.name}, home`}>
              <Monogram height={30} />
            </Link>
          </div>
        </header>
      ) : null}
      <main id="main">
        {blocks.map((b, i) => (
          <RenderBlock key={b.id || i} block={b} first={i === 0} />
        ))}
      </main>
      {s.chrome === "full" ? (
        <SiteFooter />
      ) : (
        <footer className="lp-foot">
          <div className="lp-wrap">
            © {new Date().getFullYear()} {site.fullName} · {site.tagline}
          </div>
        </footer>
      )}
      {s.sticky_label ? <StickyBar label={s.sticky_label} href={s.sticky_url} /> : null}
      <JsonLd data={ld} />
      {!preview && s.track ? <Track pageId={page.id} /> : null}
    </div>
  );
}
