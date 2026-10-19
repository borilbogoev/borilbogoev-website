import { stats } from "@/content/resume";

/** The dark stat band. Numbers are plain text in the HTML; no count-up animation to keep the page fast. */
export function StatsBand() {
  return (
    <section aria-label="Numbers" className="py-9 md:py-11" style={{ background: "var(--surface-inverse)", color: "var(--on-inverse)" }}>
      <div className="container-bb">
        <dl className="m-0 grid grid-cols-2 gap-y-8 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className="relative px-4 text-center" style={i % 2 === 1 || i > 0 ? undefined : undefined}>
              {i > 0 && <span aria-hidden className="absolute bottom-[20%] left-0 top-[20%] hidden w-px lg:block" style={{ background: "var(--on-inverse-line)" }} />}
              <dd className="t-stat m-0 order-first">
                {s.value}
                <span style={{ color: "var(--brand)" }}>+</span>
              </dd>
              <dt className="t-caption mt-1.5 font-medium" style={{ color: "var(--on-inverse-muted)" }}>
                {s.label}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
