import type { ReactNode } from "react";

/** A page section: optional eyebrow, heading and content in the 1080px container. */
export function Section({
  id,
  alt,
  eyebrow,
  heading,
  intro,
  children,
  className = "",
}: {
  id?: string;
  alt?: boolean;
  eyebrow?: string;
  heading?: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`section ${alt ? "section-alt" : ""} ${className}`}>
      <div className="container-bb">
        {(eyebrow || heading) && (
          <div className="section-head">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {heading && <h2 className="t-h1">{heading}</h2>}
            {intro && <p className="t-body-lg mt-3 max-w-[62ch]">{intro}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

/** Renders **bold** spans from content files as <strong>. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return <>{parts.map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}</>;
}
