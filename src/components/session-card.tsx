import { bulletText, sessionWhen, type SessionData } from "@/lib/session-card";
import "./session-card.css";

/** The brand's six-spoke asterisk, drawn large and in outline. */
function Asterisk() {
  return (
    <svg aria-hidden viewBox="-50 -50 100 100" className="sc__asterisk" fill="none" stroke="var(--on-inverse-line)" strokeWidth="9" strokeLinecap="round">
      <path d="M0 -42V42M-36.4 -21L36.4 21M-36.4 21L36.4 -21" />
    </svg>
  );
}

const external = (href: string) => (/^https?:\/\//i.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {});

/**
 * The Session block: a dark card with the date and time on one side and the announcement on the other.
 * A pure component (no hooks, no data loading), so every module can render it: Forms, Landing Pages, Presentations, School and the site pages.
 */
export function SessionCard({ data, className = "" }: { data: SessionData; className?: string }) {
  const when = sessionWhen(data);
  const title = (data.title ?? "").trim().replace(/\.$/, "");
  const bullets = (data.bullets ?? []).map(bulletText).filter(Boolean);
  const img = data.image?.url ? data.image : null;
  const label = data.eyebrow?.trim();
  return (
    <section aria-label={label || title || "Session"} className={`sc${when ? " sc--dated" : ""}${className ? ` ${className}` : ""}`}>
      <Asterisk />
      {when && (
        <time dateTime={when.iso} className="sc__when">
          <span className="sc__day-row">
            <span className="sc__day">
              {when.day}
              <span className="sc__dot">.</span>
            </span>
            <span className="sc__date-text">
              <span className="sc__weekday">{when.weekday}</span>
              <span className="sc__month">
                {when.month} {when.year}
              </span>
            </span>
          </span>
          {(when.clock || data.zone) && (
            <span className="sc__clock-box">
              {when.clock && <span className="sc__clock">{when.clock}</span>}
              {data.zone && <span className="sc__zone">{data.zone}</span>}
            </span>
          )}
        </time>
      )}
      <div className="sc__body">
        {img && <img className="sc__image" src={img.url} width={img.width || undefined} height={img.height || undefined} alt="" loading="lazy" decoding="async" />}
        {label && <p className="sc__eyebrow">{label}</p>}
        {title && (
          <h2 className="sc__title">
            {title}
            <span className="sc__dot">.</span>
          </h2>
        )}
        {data.subtitle && <p className="sc__subtitle">{data.subtitle}</p>}
        {data.text && <p className="sc__text">{data.text}</p>}
        {bullets.length > 0 && (
          <ul className="sc__bullets">
            {bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}
        {((data.button_label && data.button_url) || (data.secondary_label && data.secondary_url)) && (
          <div className="sc__actions">
            {data.button_label && data.button_url && (
              <a href={data.button_url} {...external(data.button_url)} className="bb-btn bb-btn-primary">
                {data.button_label}
              </a>
            )}
            {data.secondary_label && data.secondary_url && (
              <a href={data.secondary_url} {...external(data.secondary_url)} className="bb-btn bb-btn-inverse">
                {data.secondary_label}
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
