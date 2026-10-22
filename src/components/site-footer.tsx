import Link from "next/link";
import { offers } from "@/content/offers";
import { site } from "@/content/site";
import { LocationIcon } from "./icons";
import { Monogram } from "./monogram";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-surface">
      <div className="container-bb grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Link href="/" aria-label={`${site.name}, home`} className="inline-block">
            <Monogram height={34} />
          </Link>
          <p className="mt-4 max-w-[32ch] text-[15px] font-semibold">{site.positioning}</p>
          <p className="t-caption mt-2 flex items-center gap-1.5 text-muted">
            <LocationIcon size={14} />
            {site.location}
          </p>
        </div>
        <nav aria-label="Work with me">
          <p className="label mb-3 text-muted">Work with me</p>
          <ul className="m-0 grid list-none gap-1 p-0">
            {offers.map((o) => (
              <li key={o.slug}>
                <Link href={`/${o.slug}`} className="inline-flex min-h-[36px] items-center text-[15px] hover:text-brand-text">
                  {o.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="More">
          <p className="label mb-3 text-muted">More</p>
          <ul className="m-0 grid list-none gap-1 p-0">
            <li>
              <Link href="/classroom" className="inline-flex min-h-[36px] items-center text-[15px] hover:text-brand-text">
                Classroom
              </Link>
            </li>
            <li>
              <Link href="/about" className="inline-flex min-h-[36px] items-center text-[15px] hover:text-brand-text">
                About
              </Link>
            </li>
            <li>
              <Link href="/contact" className="inline-flex min-h-[36px] items-center text-[15px] hover:text-brand-text">
                Contact
              </Link>
            </li>
            <li>
              <a href={site.streamliner} target="_blank" rel="noopener" className="inline-flex min-h-[36px] items-center text-[15px] hover:text-brand-text">
                The Streamliner
              </a>
            </li>
            <li>
              <a href={site.linkedin} target="_blank" rel="noopener" className="inline-flex min-h-[36px] items-center text-[15px] hover:text-brand-text">
                LinkedIn
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="container-bb t-caption py-5 text-muted">
          © {year} {site.fullName} · {site.tagline}
        </p>
      </div>
    </footer>
  );
}
