// Server pieces of the public catalog: the hub, a category, a course. Pure markup; the only client part is the enrolment panel.
import Link from "next/link";
import { Monogram } from "@/components/monogram";
import { formatPrice, LANGUAGES, LEVELS, type Img } from "../lib/course-settings";
import type { Category, Course } from "../lib/courses";
import "./classroom.css";

export function Cover({ img, alt = "", ratio = "16 / 9", sizes = "(min-width: 1024px) 340px, 100vw", priority = false }: { img?: Img | null; alt?: string; ratio?: string; sizes?: string; priority?: boolean }) {
  const srcSet = img?.variants?.length ? img.variants.map((v) => `${v.url} ${v.w}w`).join(", ") : undefined;
  return (
    <div className="cr-cover" style={{ aspectRatio: ratio }}>
      {img?.url ? (
        <img src={img.url} srcSet={srcSet} sizes={srcSet ? sizes : undefined} width={img.width || undefined} height={img.height || undefined} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : undefined} />
      ) : (
        <span className="cr-cover__ph" aria-hidden="true">
          <Monogram height={34} />
        </span>
      )}
    </div>
  );
}

export function CategoryCard({ c }: { c: Category }) {
  return (
    <Link href={`/classroom/category/${c.slug}`} className="card cr-tile">
      <Cover img={c.image} alt="" />
      <div className="cr-tile__body">
        <h3 className="t-h3">{c.name}</h3>
        {c.summary ? <p className="t-body-sm">{c.summary}</p> : null}
        <p className="cr-meta">
          {c.courses} {c.courses === 1 ? "course" : "courses"}
        </p>
      </div>
    </Link>
  );
}

export function CourseCard({ c, lessons, modules }: { c: Course; lessons: number; modules: number }) {
  const level = c.settings.level ? LEVELS[c.settings.level] : "";
  return (
    <Link href={`/classroom/${c.slug}`} className="card cr-tile">
      <Cover img={c.image} alt="" />
      <div className="cr-tile__body">
        <div className="cr-tile__chips">
          {level ? <span className="tag">{level}</span> : null}
          <span className={`tag${c.access === "paid" ? "" : " tag-red"}`}>{c.access === "invite" ? "By invitation" : formatPrice(c.access === "paid" ? c.priceCents : 0, c.currency)}</span>
        </div>
        <h3 className="t-h3">{c.title}</h3>
        {c.summary ? <p className="t-body-sm">{c.summary}</p> : null}
        <p className="cr-meta">
          {modules} {modules === 1 ? "module" : "modules"} · {lessons} {lessons === 1 ? "lesson" : "lessons"}
          {c.settings.duration ? ` · ${c.settings.duration}` : ""}
        </p>
      </div>
    </Link>
  );
}

export const languageName = (code: string) => LANGUAGES[code] ?? code;
