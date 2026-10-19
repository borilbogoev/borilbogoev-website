import Link from "next/link";
import { founderBio, site } from "@/content/site";
import { ArrowRightIcon } from "./icons";

/** The one dark band on an offer page: who runs it. */
export function FounderBand() {
  return (
    <section id="founder" className="section" style={{ background: "var(--surface-inverse)", color: "var(--on-inverse)" }}>
      <div className="container-bb grid items-center gap-10 md:grid-cols-[auto_1fr] md:gap-16">
        <div className="portrait mx-auto h-[160px] w-[160px] md:h-[200px] md:w-[200px]">
          <img
            src="/brand/portrait-320.webp"
            srcSet="/brand/portrait-320.webp 320w, /brand/portrait-640.webp 640w"
            sizes="(min-width: 768px) 200px, 160px"
            width={200}
            height={200}
            alt={`${site.fullName}, portrait illustration`}
            loading="lazy"
            decoding="async"
          />
        </div>
        <div>
          <p className="eyebrow" style={{ color: "var(--on-inverse-accent)" }}>
            Founder
          </p>
          <h2 className="t-h1 mt-2.5">Who runs it</h2>
          <p className="mt-5 max-w-[58ch] text-[16px] leading-[1.75]" style={{ color: "var(--on-inverse-muted)" }}>
            {founderBio}
          </p>
          <Link href="/about" className="mt-6 inline-flex min-h-[44px] items-center gap-2 text-[14px] font-semibold hover:underline" style={{ color: "var(--on-inverse)" }}>
            Read the full resume <ArrowRightIcon size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
