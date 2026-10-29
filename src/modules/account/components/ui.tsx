// Small pieces of the account area. Server components: no state.
import type { ReactNode } from "react";
import Link from "next/link";
import { Monogram } from "@/components/monogram";
import type { Img } from "@/modules/school/lib/course-settings";
import type { AccountCourse } from "../lib/data";
import type { Profile } from "../lib/profile";
import "./account.css";

export const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const fmtDateTime = (d: Date) => `${fmtDate(d)}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;

export function Avatar({ name, url, size = 40 }: { name: string; url?: string; size?: number }) {
  const initials = (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  return (
    <span className="ac-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden="true">
      {url ? <img src={url} alt="" width={size} height={size} /> : initials}
    </span>
  );
}

export function PageHead({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <header className="ac-head">
      <p className="eyebrow">{eyebrow}</p>
      <h1>
        {title}
        <span className="accent">.</span>
      </h1>
      {intro ? <p>{intro}</p> : null}
    </header>
  );
}

export function SectionHead({ eyebrow, title, href, linkLabel }: { eyebrow: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="ac-section__head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {href ? (
        <Link href={href} className="ac-link">
          {linkLabel ?? "See all"} →
        </Link>
      ) : null}
    </div>
  );
}

export function Empty({ title, text, href, label }: { title: string; text: string; href?: string; label?: string }) {
  return (
    <div className="ac-empty">
      <h2>{title}</h2>
      <p>{text}</p>
      {href ? (
        <Link href={href} className="bb-btn bb-btn-outline">
          {label}
        </Link>
      ) : null}
    </div>
  );
}

function Cover({ img }: { img: Img }) {
  const srcSet = img.variants?.length ? img.variants.map((v) => `${v.url} ${v.w}w`).join(", ") : undefined;
  return (
    <div className="ac-cover">
      {img.url ? (
        <img src={img.url} srcSet={srcSet} sizes={srcSet ? "(min-width: 900px) 340px, 100vw" : undefined} width={img.width || undefined} height={img.height || undefined} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="ac-cover__ph" aria-hidden="true">
          <Monogram height={34} />
        </span>
      )}
    </div>
  );
}

export function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="ac-progress">
      <div className="ac-progress__row">
        <span>{done} of {total} lessons</span>
        <span>{pct}%</span>
      </div>
      <div className="ac-progress__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** A course the person is enrolled in: picture, titles, progress, size, join date and the way in. */
export function CourseSnippet({ c, compact = false }: { c: AccountCourse; compact?: boolean }) {
  return (
    <article className="ac-card">
      <Cover img={c.image} />
      <div className="ac-card__body">
        <div className="ac-chips">
          {c.category ? <span className="tag">{c.category}</span> : null}
          {c.pending ? <span className="tag tag-red">Waiting for payment</span> : <span className="tag tag-red">Enrolled</span>}
        </div>
        <h3 className="ac-card__title">{c.title}</h3>
        {c.subtitle ? <p className="ac-card__sub">{c.subtitle}</p> : null}
        {!compact && c.summary ? <p className="ac-card__text">{c.summary}</p> : null}
        <dl className="ac-facts">
          <div>
            <dt>Modules</dt>
            <dd>{c.modules}</dd>
          </div>
          <div>
            <dt>Lessons</dt>
            <dd>{c.lessons}</dd>
          </div>
          <div>
            <dt>Joined</dt>
            <dd>{fmtDate(c.joinedAt)}</dd>
          </div>
        </dl>
        {!c.pending ? <Progress done={c.done} total={c.lessons} label={`Progress in ${c.title}`} /> : null}
        <div className="ac-card__foot">
          <Link href={c.detailsHref} className="bb-btn bb-btn-primary ac-btn-sm">
            Course details
          </Link>
          {!c.pending ? (
            <Link href={c.continueHref} className="ac-link">
              {c.done ? "Continue learning" : "Start learning"} →
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function ProfileSummary({ p, completeness }: { p: Profile; completeness: { done: number; total: number; missing: string[] } }) {
  const role = [p.jobTitle, p.company].filter(Boolean).join(", ");
  return (
    <div className="ac-card">
      <div className="ac-summary">
        <Avatar name={p.name || p.email} url={p.avatarUrl} size={72} />
        <div>
          <h3 className="ac-summary__name">{p.name || p.email}</h3>
          <p className="ac-summary__meta">
            {p.username ? `@${p.username} · ` : ""}
            {p.email}
            {role ? ` · ${role}` : ""}
          </p>
          <p className="ac-summary__meta">
            Member since {fmtDate(p.createdAt)}
            {completeness.missing.length ? ` · Profile ${completeness.done} of ${completeness.total} complete` : " · Profile complete"}
          </p>
        </div>
        <Link href="/account/info" className="bb-btn bb-btn-outline ac-btn-sm">
          {completeness.missing.length ? "Complete my info" : "My info"}
        </Link>
      </div>
    </div>
  );
}

export function Row({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <li className="ac-row">
      <div>{children}</div>
      {action}
    </li>
  );
}
