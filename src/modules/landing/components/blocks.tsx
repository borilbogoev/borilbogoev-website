// Server renderers of every landing block. Pure HTML and CSS; interaction lives in client.tsx.
import type { CSSProperties, ReactNode } from "react";
import { renderMarkdown } from "@/modules/forms/lib/markdown";
import { embedAllowed, type LandingBlock, type Settings } from "../lib/blocks";
import { parseAudio, parseVideo, ratioPadding } from "../lib/media";
import { Carousel, Countdown, LazyForm, VideoPlayer } from "./client";
import { LIcon } from "./icons";

type S = Settings;
type Img = { url?: string; width?: number; height?: number; variants?: { w: number; url: string }[] };

const MD = (text: unknown) => ({ __html: renderMarkdown(String(text ?? "")) });
const lines = (v: unknown) => String(v ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

/* -------------------------------------------------------------------------- */
/* Small parts                                                                */
/* -------------------------------------------------------------------------- */

/** A trailing full stop is the brand's signature: set it in red. */
function Dotted({ text, force }: { text: string; force?: boolean }) {
  const t = String(text ?? "");
  if (force || t.endsWith(".")) return (
    <>
      {t.replace(/\.$/, "")}
      <span className="accent">.</span>
    </>
  );
  return <>{t}</>;
}

export function Pic({ img, alt, sizes, priority, className = "", style }: { img?: Img | null; alt?: string; sizes?: string; priority?: boolean; className?: string; style?: CSSProperties }) {
  if (!img?.url) return null;
  const srcSet = img.variants?.length ? img.variants.map((v) => `${v.url} ${v.w}w`).join(", ") : undefined;
  return (
    <img
      className={`lp-pic ${className}`.trim()}
      style={style}
      src={img.url}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      width={img.width}
      height={img.height}
      alt={alt ?? ""}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
    />
  );
}

/** A picture cropped to a fixed shape. */
function Ratio({ img, alt, ratio, sizes }: { img?: Img | null; alt?: string; ratio: string; sizes?: string }) {
  if (!img?.url) return null;
  return (
    <div className="lp-ratio" style={{ paddingTop: ratioPadding(ratio) }}>
      <Pic img={img} alt={alt} sizes={sizes} />
    </div>
  );
}

function Avatar({ img, alt = "" }: { img?: Img | null; alt?: string }) {
  if (!img?.url) return null;
  return <img className="lp-avatar" src={img.variants?.[0]?.url ?? img.url} width={48} height={48} alt={alt} loading="lazy" decoding="async" />;
}

const isExternal = (href: string) => /^https?:\/\//i.test(href);

type BtnProps = { block: LandingBlock; label: string; href: string; style?: string; size?: string; icon?: string; newTab?: boolean };

export function Btn({ block, label, href, style = "primary", size = "md", icon = "none", newTab }: BtnProps) {
  if (!label || !href) return null;
  const cls = `bb-btn bb-btn-${["primary", "dark", "outline", "inverse", "tint", "link"].includes(style) ? style : "primary"}${size === "lg" ? " bb-btn-lg" : ""}`;
  const external = newTab || (isExternal(href) && !href.startsWith("https://borilbogoev.com"));
  return (
    <a href={href} className={cls} target={newTab ? "_blank" : undefined} rel={external ? "noopener" : undefined} data-lp-b={block.id} data-lp-t={block.type} data-lp-l={label}>
      {label}
      {icon !== "none" ? <LIcon name={icon} size={16} /> : null}
    </a>
  );
}

function Head({ s, center, id }: { s: S; center?: boolean; id?: string }) {
  if (!s.eyebrow && !s.heading && !s.intro) return null;
  return (
    <div className={`lp-head${center ? " lp-center" : ""}`}>
      {s.eyebrow ? <p className="eyebrow">{s.eyebrow}</p> : null}
      {s.heading ? (
        <h2 className="lp-h" id={id}>
          <Dotted text={s.heading} />
        </h2>
      ) : null}
      {s.intro ? <p className="lp-intro">{s.intro}</p> : null}
    </div>
  );
}

/** The section element every block sits in: background, spacing, anchor and responsive visibility. */
function Sec({ b, children, narrow, cls = "", flow }: { b: LandingBlock; children: ReactNode; narrow?: boolean; cls?: string; flow?: boolean }) {
  const s = b.settings;
  const bg = s.bg === "alt" ? " lp-bg-alt" : s.bg === "inverse" ? " lp-bg-inverse" : "";
  const sp = s.spacing && s.spacing !== "normal" ? ` lp-sp-${s.spacing}` : "";
  const hide = s.hide === "mobile" ? " lp-hide-mobile" : s.hide === "desktop" ? " lp-hide-desktop" : "";
  return (
    <section id={s.anchor || undefined} className={`lp-sec${flow ? " lp-flow" : ""}${bg}${sp}${hide} ${cls}`.trim()}>
      <div className={`lp-wrap${narrow ? " lp-narrow" : ""}`}>{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

function Hero({ b, withImage, first }: { b: LandingBlock; withImage: boolean; first: boolean }) {
  const s = b.settings;
  const img = withImage ? (s.image as Img) : null;
  const center = !withImage && s.align === "center";
  const long = String(s.headline ?? "").length > 46;
  const bullets = (s.bullets as string[]) ?? [];
  const facts = (s.facts as S[]) ?? [];
  const sp = s.spacing && s.spacing !== "normal" ? ` lp-sp-${s.spacing}` : "";
  const style = s.style === "plain" ? "plain" : s.style === "inverse" ? "inverse" : "soft";
  return (
    <section id={s.anchor || undefined} className={`lp-hero lp-hero--${style}${sp}`}>
      <div className="lp-wrap">
        <div className={`lp-hero__grid${img?.url ? " has-img" : ""}${s.image_side === "left" ? " is-left" : ""}`}>
          <div className={center ? "lp-center" : undefined}>
            {s.badge ? (
              <p style={{ margin: "0 0 16px" }}>
                <span className="badge t-meta">{s.badge}</span>
              </p>
            ) : null}
            {s.eyebrow ? (
              <p className="eyebrow" style={{ margin: 0 }}>
                {s.eyebrow}
              </p>
            ) : null}
            <h1 className={`lp-title${long ? " is-long" : ""}`}>
              <Dotted text={s.headline} force={!!s.accent_dot} />
            </h1>
            {s.subtitle ? <p className="lp-sub">{s.subtitle}</p> : null}
            {s.text ? <div className="lp-md" style={{ marginTop: 20, maxWidth: "58ch" }} dangerouslySetInnerHTML={MD(s.text)} /> : null}
            {bullets.length ? (
              <ul className="lp-bullets">
                {bullets.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            ) : null}
            {(s.cta_label && s.cta_url) || (s.secondary_label && s.secondary_url) ? (
              <div className="lp-actions">
                <Btn block={b} label={s.cta_label} href={s.cta_url} size="lg" style={style === "inverse" ? "primary" : "primary"} />
                <Btn block={b} label={s.secondary_label} href={s.secondary_url} style="outline" size="lg" />
              </div>
            ) : null}
            {s.note ? <p className="lp-note">{s.note}</p> : null}
            {facts.length ? (
              <dl className="lp-facts">
                {facts.map((f, i) => (
                  <div key={i}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
          {img?.url ? (
            <figure className="lp-hero__media">
              {s.image_style === "portrait" ? (
                <div className="portrait lp-portrait">
                  <img src={img.variants?.[Math.min(1, img.variants.length - 1)]?.url ?? img.url} srcSet={img.variants?.map((v) => `${v.url} ${v.w}w`).join(", ")} sizes="(min-width: 900px) 360px, 80vw" width={img.width} height={img.height} alt={s.image_alt || ""} loading={first ? "eager" : "lazy"} decoding="async" fetchPriority={first ? "high" : undefined} />
                </div>
              ) : (
                <Pic img={img} alt={s.image_alt} priority={first} sizes="(min-width: 900px) 520px, 100vw" className={s.image_style === "plain" ? "is-plain" : ""} style={s.image_style === "plain" ? undefined : { boxShadow: "var(--shadow)" }} />
              )}
              {s.image_caption ? <figcaption>{s.image_caption}</figcaption> : null}
            </figure>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Conversion                                                                 */
/* -------------------------------------------------------------------------- */

function Cta({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const center = s.align === "center";
  const bullets = (s.bullets as string[]) ?? [];
  if (s.length === "short") {
    return (
      <Sec b={b} cls="lp-sp-short">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: center ? "center" : "space-between", gap: "20px 40px", textAlign: center ? "center" : undefined }}>
          <div style={{ flex: "1 1 360px" }}>
            {s.eyebrow ? <p className="eyebrow" style={{ margin: "0 0 6px" }}>{s.eyebrow}</p> : null}
            <p className="lp-h" style={{ fontSize: "clamp(22px,2.6vw,30px)" }}>
              <Dotted text={s.heading} />
            </p>
            {s.text ? <p className="lp-intro" style={{ margin: "8px 0 0" }}>{s.text}</p> : null}
          </div>
          <div className="lp-actions" style={{ margin: 0 }}>
            <Btn block={b} label={s.cta_label} href={s.cta_url} size="lg" />
            <Btn block={b} label={s.secondary_label} href={s.secondary_url} style="outline" size="lg" />
          </div>
        </div>
        {s.note ? <p className="lp-note" style={{ textAlign: center ? "center" : undefined }}>{s.note}</p> : null}
      </Sec>
    );
  }
  return (
    <Sec b={b} narrow>
      <div className={center ? "lp-center" : undefined}>
        {s.eyebrow ? <p className="eyebrow" style={{ margin: "0 0 12px" }}>{s.eyebrow}</p> : null}
        <h2 className="lp-title is-long" style={{ marginTop: 0 }}>
          <Dotted text={s.heading} />
        </h2>
        {s.text ? <p className="lp-intro" style={{ fontSize: 18, marginTop: 18 }}>{s.text}</p> : null}
        {bullets.length ? (
          <ul className="lp-bullets" style={center ? { justifyItems: "center" } : undefined}>
            {bullets.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : null}
        <div className="lp-actions">
          <Btn block={b} label={s.cta_label} href={s.cta_url} size="lg" />
          <Btn block={b} label={s.secondary_label} href={s.secondary_url} style="outline" size="lg" />
        </div>
        {s.note ? <p className="lp-note">{s.note}</p> : null}
      </div>
    </Sec>
  );
}

function Buttons({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const items = (s.items as S[]) ?? [];
  if (!items.length) return null;
  return (
    <Sec b={b} flow cls={s.align === "center" ? "lp-center" : s.align === "right" ? "lp-right" : ""}>
      <div className={`lp-actions${s.layout === "stack" ? " is-stack" : ""}`} style={{ marginTop: 0 }}>
        {items.map((it, i) => (
          <Btn key={i} block={b} label={it.label} href={it.url} style={it.style} size={it.size} icon={it.icon} newTab={!!it.new_tab} />
        ))}
      </div>
    </Sec>
  );
}

function FormBlock({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const id = Number(s.form_id);
  const modal = s.display === "modal";
  const theme = s.theme === "dark" ? "dark" : "light";
  return (
    <Sec b={b} narrow={s.width !== "wide"}>
      <Head s={s} center={modal} />
      {id > 0 ? (
        modal ? (
          <div className="lp-center">
            <span data-lp-b={b.id} data-lp-t="form" data-lp-l={s.button_label}>
              <LazyForm id={id} display="modal" label={s.button_label || "Open the form"} theme={theme} />
            </span>
          </div>
        ) : (
          <div className="lp-form">
            <LazyForm id={id} display="inline" label="" theme={theme} />
          </div>
        )
      ) : (
        <p className="lp-note">Choose a form in the block settings.</p>
      )}
    </Sec>
  );
}

/* -------------------------------------------------------------------------- */
/* Proof                                                                      */
/* -------------------------------------------------------------------------- */

function Quote({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const center = s.align === "center";
  const img = s.image as Img;
  return (
    <Sec b={b} cls={center ? "lp-center" : ""} narrow={s.style === "card"}>
      <figure className={`lp-quote${s.style === "card" ? " is-card" : ""}`}>
        <blockquote>{s.quote}</blockquote>
        {s.author || s.role ? (
          <figcaption>
            <Avatar img={img} alt={s.author} />
            <span className="lp-who">
              {s.author ? <strong>{s.author}</strong> : null}
              {s.role ? <span>{s.role}</span> : null}
            </span>
          </figcaption>
        ) : null}
      </figure>
    </Sec>
  );
}

function Stats({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const items = (s.items as S[]) ?? [];
  return (
    <Sec b={b}>
      <Head s={s} />
      <div className={`lp-stats${s.style === "cards" ? " is-cards" : ""}`}>
        {items.map((it, i) => (
          <div className="lp-stat" key={i}>
            <strong>
              {it.prefix}
              {it.value}
              {it.suffix ? <i>{it.suffix}</i> : null}
            </strong>
            <span>{it.label}</span>
            {it.note ? <small>{it.note}</small> : null}
          </div>
        ))}
      </div>
    </Sec>
  );
}

function Testimonials({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const items = (s.items as S[]) ?? [];
  if (!items.length) return null;
  const one = (it: S, i: number, big = false) => (
    <figure className={big ? "lp-quote" : "lp-tcard"} key={i}>
      <blockquote style={big ? undefined : undefined}>{it.quote}</blockquote>
      {it.result ? <span className="tag tag-red lp-result">{it.result}</span> : null}
      <figcaption>
        <Avatar img={it.image} alt={it.name} />
        <span className="lp-who">
          <strong>{it.name}</strong>
          {it.role ? <span>{it.role}</span> : null}
        </span>
      </figcaption>
    </figure>
  );
  return (
    <Sec b={b}>
      <Head s={s} center={s.layout === "featured"} />
      {s.layout === "featured" ? (
        <div className="lp-center">{one(items[0], 0, true)}</div>
      ) : s.layout === "list" ? (
        <div className="lp-tlist">{items.map((it, i) => one(it, i))}</div>
      ) : (
        <div className={`lp-grid ${items.length === 2 ? "lp-cols-2" : items.length === 1 ? "" : "lp-cols-3"}`}>
          {items.map((it, i) => (
            <div className="card" key={i} style={{ height: "100%" }}>
              {one(it, i)}
            </div>
          ))}
        </div>
      )}
    </Sec>
  );
}

function Logos({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const items = (s.items as S[]) ?? [];
  if (!items.length) return null;
  return (
    <Sec b={b} cls="lp-sp-tight">
      {s.label ? <p className="lp-logos-label">{s.label}</p> : null}
      <ul className="lp-logos">
        {items.map((it, i) => {
          const inner = it.image?.url ? <img src={it.image.variants?.[0]?.url ?? it.image.url} width={it.image.width} height={it.image.height} alt={it.name} loading="lazy" decoding="async" /> : <span className="chip">{it.name}</span>;
          return <li key={i}>{it.url ? <a href={it.url} target="_blank" rel="noopener" data-lp-b={b.id} data-lp-t={b.type} data-lp-l={it.name}>{inner}</a> : inner}</li>;
        })}
      </ul>
    </Sec>
  );
}

function Bio({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const img = s.image as Img;
  const creds = (s.credentials as string[]) ?? [];
  return (
    <Sec b={b}>
      <div className={`lp-hero__grid${img?.url ? " has-img" : ""}${s.image_side === "left" ? " is-left" : ""}`} style={img?.url ? { gridTemplateColumns: undefined } : undefined}>
        <div>
          {s.eyebrow ? <p className="eyebrow" style={{ margin: "0 0 10px" }}>{s.eyebrow}</p> : null}
          <h2 className="lp-h">{s.name}</h2>
          {s.role ? <p className="t-overline" style={{ margin: "8px 0 0" }}>{s.role}</p> : null}
          {s.text ? <div className="lp-md" style={{ marginTop: 20, maxWidth: "58ch" }} dangerouslySetInnerHTML={MD(s.text)} /> : null}
          {creds.length ? (
            <ul className="lp-bullets">
              {creds.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : null}
          {s.link_label && s.link_url ? (
            <p style={{ marginTop: 24 }}>
              <a className="lp-link" href={s.link_url} data-lp-b={b.id} data-lp-t={b.type} data-lp-l={s.link_label}>
                {s.link_label}
                <LIcon name="arrow" size={16} />
              </a>
            </p>
          ) : null}
        </div>
        {img?.url ? (
          <div className="portrait lp-portrait">
            <img src={img.variants?.[Math.min(1, img.variants.length - 1)]?.url ?? img.url} srcSet={img.variants?.map((v) => `${v.url} ${v.w}w`).join(", ")} sizes="(min-width: 900px) 360px, 80vw" width={img.width} height={img.height} alt={s.image_alt || ""} loading="lazy" decoding="async" />
          </div>
        ) : null}
      </div>
    </Sec>
  );
}

/* -------------------------------------------------------------------------- */
/* Content                                                                    */
/* -------------------------------------------------------------------------- */

function Cards({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const items = (s.items as S[]) ?? [];
  const ratio = s.ratio === "none" ? "" : String(s.ratio);
  return (
    <Sec b={b}>
      <Head s={s} />
      <div className={`lp-grid lp-cols-${s.columns}`}>
        {items.map((it, i) => (
          <article className={`card lp-card${ratio && it.image?.url ? " lp-card--media" : ""}`} key={i}>
            {ratio && it.image?.url ? <Ratio img={it.image} alt={it.image_alt} ratio={ratio} sizes="(min-width: 960px) 340px, (min-width: 640px) 50vw, 100vw" /> : null}
            <div className={ratio && it.image?.url ? "lp-card__body" : undefined} style={ratio && it.image?.url ? undefined : { display: "contents" }}>
              <h3>{it.title}</h3>
              {it.text ? <p>{it.text}</p> : null}
              {it.link_label && it.link_url ? (
                <a className="lp-link" href={it.link_url} data-lp-b={b.id} data-lp-t={b.type} data-lp-l={it.link_label}>
                  {it.link_label}
                  <LIcon name="arrow" size={16} />
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </Sec>
  );
}

function Features({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const items = (s.items as S[]) ?? [];
  return (
    <Sec b={b}>
      <Head s={s} />
      <div className={`lp-grid lp-cols-${s.columns}`}>
        {items.map((it, i) =>
          s.style === "plain" ? (
            <div className="lp-plain-item" key={i}>
              <span className="icon-well">
                <LIcon name={it.icon} />
              </span>
              <h3>{it.title}</h3>
              {it.text ? <p>{it.text}</p> : null}
            </div>
          ) : (
            <div className="card lp-card" key={i}>
              <span className="icon-well">
                <LIcon name={it.icon} />
              </span>
              <h3>{it.title}</h3>
              {it.text ? <p>{it.text}</p> : null}
            </div>
          ),
        )}
      </div>
    </Sec>
  );
}

function Steps({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const items = (s.items as S[]) ?? [];
  const cards = s.layout !== "list";
  return (
    <Sec b={b}>
      <Head s={s} />
      <ol className={`lp-steps ${cards ? "is-cards" : "is-list"}`} style={{ ["--n" as string]: Math.min(4, Math.max(2, items.length)) }}>
        {items.map((it, i) => (
          <li className={cards ? "card lp-step" : "lp-step"} key={i}>
            <p className="lp-step__n" style={{ margin: 0 }}>{String(i + 1).padStart(2, "0")}</p>
            <div>
              <h3>{it.title}</h3>
              {it.text ? <p>{it.text}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </Sec>
  );
}

function List({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const items = (s.items as string[]) ?? [];
  return (
    <Sec b={b}>
      <Head s={s} />
      <ul className={`lp-points${s.columns === "2" ? " is-2" : ""}`}>
        {items.map((x) => (
          <li key={x}>
            {s.mark === "dot" ? (
              <span className="lp-dot" aria-hidden />
            ) : (
              <span className="icon-well" style={s.mark === "cross" ? { background: "var(--surface-alt)", color: "var(--ink-muted)" } : undefined}>
                <LIcon name={s.mark === "cross" ? "minus" : "check"} />
              </span>
            )}
            <span style={{ paddingTop: s.mark === "dot" ? 0 : 7 }}>{x}</span>
          </li>
        ))}
      </ul>
    </Sec>
  );
}

function Compare({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const col = (title: string, items: string[], after: boolean) => (
    <div className={`card ${after ? "is-after" : "is-before"}`}>
      <h3>{title}</h3>
      <ul className={`lp-ticks${after ? "" : " is-minus"}`}>
        {items.map((x) => (
          <li key={x}>
            <LIcon name={after ? "check" : "minus"} />
            <span>{x}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <Sec b={b}>
      <Head s={s} />
      <div className="lp-compare">
        {col(s.left_title, s.left_items ?? [], false)}
        {col(s.right_title, s.right_items ?? [], true)}
      </div>
    </Sec>
  );
}

function Heading({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const center = s.align === "center" ? " lp-center" : s.align === "right" ? " lp-right" : "";
  const inner = <Dotted text={s.text} force={!!s.accent_dot} />;
  const level = s.level;
  return (
    <Sec b={b} flow cls={center}>
      {s.eyebrow ? <p className="eyebrow" style={{ margin: "0 0 10px" }}>{s.eyebrow}</p> : null}
      {level === "h1" ? <h2 className="lp-title is-long" style={{ marginTop: 0 }}>{inner}</h2> : level === "h3" ? <h3 className="lp-h" style={{ fontSize: 24 }}>{inner}</h3> : level === "h4" ? <h4 className="t-h3" style={{ margin: 0 }}>{inner}</h4> : <h2 className="lp-h">{inner}</h2>}
    </Sec>
  );
}

function TextBlock({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const center = s.align === "center" ? " lp-center" : s.align === "right" ? " lp-right" : "";
  return (
    <Sec b={b} flow cls={center}>
      <div className={`lp-md${s.size === "lg" ? " is-lg" : s.size === "sm" ? " is-sm" : ""}`} style={{ maxWidth: "72ch", marginInline: s.align === "center" ? "auto" : undefined }} dangerouslySetInnerHTML={MD(s.content)} />
    </Sec>
  );
}

function ImageBlock({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const img = s.image as Img;
  if (!img?.url) return null;
  const pic = <Pic img={img} alt={s.alt} sizes="(min-width: 1000px) 1000px, 100vw" className={s.rounded ? "" : "is-plain"} />;
  const margin = s.align === "center" ? "0 auto" : s.align === "right" ? "0 0 0 auto" : "0";
  return (
    <Sec b={b} flow>
      <figure className="lp-fig" style={{ width: `${s.width}%`, margin }}>
        {s.link ? (
          <a href={s.link} data-lp-b={b.id} data-lp-t={b.type} data-lp-l={s.alt || "Image"}>
            {pic}
          </a>
        ) : (
          pic
        )}
        {s.caption ? <figcaption>{s.caption}</figcaption> : null}
      </figure>
    </Sec>
  );
}

function Divider({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const pad = { paddingBlock: s.spacing, color: s.color } as CSSProperties;
  return (
    <div className="lp-wrap" style={pad} aria-hidden>
      {s.style === "dots" ? (
        <div className="lp-dots">
          <i />
          <i />
          <i />
        </div>
      ) : s.style === "accent" ? (
        <hr className="lp-div" style={{ width: 48, borderTop: "4px solid var(--brand)", borderRadius: 4 }} />
      ) : (
        <hr className="lp-div" style={{ width: `${s.width}%`, borderTop: `${s.thickness}px ${s.style} ${s.color}` }} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Media                                                                      */
/* -------------------------------------------------------------------------- */

function posterOf(img: Img | null | undefined) {
  if (!img?.url) return null;
  return { src: img.variants?.length ? img.variants[img.variants.length - 1].url : img.url, srcSet: img.variants?.map((v) => `${v.url} ${v.w}w`).join(", "), width: img.width, height: img.height };
}

function Video({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const source = s.url ? parseVideo(s.url) : null;
  return (
    <Sec b={b}>
      <Head s={s} center />
      {source ? (
        <div className={`lp-media-box${s.width === "narrow" ? " is-narrow" : ""}`}>
          <VideoPlayer source={source} title={s.title || "Video"} poster={posterOf(s.poster)} ratio={s.ratio} />
          {s.caption ? <p className="lp-note lp-center">{s.caption}</p> : null}
        </div>
      ) : (
        <p className="lp-note lp-center">Add a YouTube, Vimeo, Loom or MP4 link in the block settings.</p>
      )}
    </Sec>
  );
}

function Audio({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const source = s.url ? parseAudio(s.url) : null;
  const art = s.artwork as Img;
  if (!source) return null;
  return (
    <Sec b={b} narrow>
      <Head s={s} />
      <div className={`card lp-audio${art?.url ? " has-art" : ""}`}>
        {art?.url ? <Ratio img={art} alt="" ratio="1:1" sizes="120px" /> : null}
        <div>
          {s.title ? <h3>{s.title}</h3> : null}
          {s.description ? <p>{s.description}</p> : null}
          {source.kind === "file" ? <audio controls preload="none" src={source.src} aria-label={s.title || "Audio"} /> : <iframe src={source.embed} title={s.title || "Audio"} loading="lazy" height={152} allow="encrypted-media" />}
        </div>
        {s.transcript ? (
          <details className="lp-transcript" style={{ gridColumn: "1 / -1" }}>
            <summary>Read the transcript</summary>
            <div className="lp-md is-sm" style={{ marginTop: 12 }} dangerouslySetInnerHTML={MD(s.transcript)} />
          </details>
        ) : null}
      </div>
    </Sec>
  );
}

function Embed({ b }: { b: LandingBlock }) {
  const s = b.settings;
  if (!s.url || !embedAllowed(s.url)) return s.url ? <Sec b={b}><p className="lp-note">This address cannot be embedded. Allowed: Calendly, Cal.com, Tally, Typeform, Google Forms.</p></Sec> : null;
  return (
    <Sec b={b}>
      <Head s={s} center />
      <iframe className="lp-embed" src={s.url} title={s.title || "Embedded content"} height={s.height} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
    </Sec>
  );
}

function Gallery({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const items = ((s.items as S[]) ?? []).filter((i) => i.image?.url);
  return (
    <Sec b={b}>
      <Head s={s} />
      <div className={`lp-gallery c${s.columns}`}>
        {items.map((it, i) => (
          <figure key={i}>
            {s.ratio === "original" ? <Pic img={it.image} alt={it.alt} sizes="(min-width: 900px) 340px, 50vw" /> : <Ratio img={it.image} alt={it.alt} ratio={s.ratio} sizes="(min-width: 900px) 340px, 50vw" />}
            {it.caption ? <figcaption>{it.caption}</figcaption> : null}
          </figure>
        ))}
      </div>
    </Sec>
  );
}

function CarouselBlock({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const items = (s.items as S[]) ?? [];
  if (!items.length) return null;
  return (
    <Sec b={b}>
      <Head s={s} />
      <Carousel perView={Number(s.per_view) || 1} autoplay={Number(s.autoplay) || 0} label={s.heading || "Slides"}>
        {items.map((it, i) => (
          <div className="lp-car__slide" key={i}>
            <article className="card lp-card lp-card--media">
              {it.image?.url ? <Ratio img={it.image} alt={it.alt} ratio={s.ratio} sizes="(min-width: 900px) 1000px, 100vw" /> : null}
              {it.title || it.text || it.link_label ? (
                <div className="lp-card__body">
                  {it.title ? <h3>{it.title}</h3> : null}
                  {it.text ? <p>{it.text}</p> : null}
                  {it.link_label && it.link_url ? (
                    <a className="lp-link" href={it.link_url} data-lp-b={b.id} data-lp-t={b.type} data-lp-l={it.link_label}>
                      {it.link_label}
                      <LIcon name="arrow" size={16} />
                    </a>
                  ) : null}
                </div>
              ) : null}
            </article>
          </div>
        ))}
      </Carousel>
    </Sec>
  );
}

/* -------------------------------------------------------------------------- */
/* Offer                                                                      */
/* -------------------------------------------------------------------------- */

function Pricing({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const items = (s.items as S[]) ?? [];
  return (
    <Sec b={b}>
      <Head s={s} />
      <div className="lp-plans">
        {items.map((it, i) => (
          <div className={`lp-plan${it.highlight ? " is-hl" : ""}`} key={i}>
            {it.badge ? (
              <p style={{ margin: 0 }}>
                <span className="tag tag-red">{it.badge}</span>
              </p>
            ) : null}
            <h3>{it.name}</h3>
            <div className="lp-price">
              <strong>{it.price}</strong>
              {it.period ? <span>{it.period}</span> : null}
            </div>
            {it.description ? <p>{it.description}</p> : null}
            <ul className="lp-ticks">
              {lines(it.features).map((f) => (
                <li key={f}>
                  <LIcon name="check" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Btn block={b} label={it.button_label} href={it.button_url} style={it.highlight ? "primary" : "dark"} />
          </div>
        ))}
      </div>
      {s.footnote ? <p className="lp-foot-note">{s.footnote}</p> : null}
    </Sec>
  );
}

function Guarantee({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const points = (s.points as string[]) ?? [];
  return (
    <Sec b={b} narrow>
      <div className="lp-guarantee">
        <div className="lp-seal">
          <LIcon name="shield" size={32} />
          {s.badge ? <strong>{s.badge}</strong> : null}
        </div>
        <div>
          {s.eyebrow ? <p className="eyebrow" style={{ margin: "0 0 10px" }}>{s.eyebrow}</p> : null}
          <h2 className="lp-h">
            <Dotted text={s.heading} />
          </h2>
          {s.text ? <div className="lp-md" style={{ marginTop: 14 }} dangerouslySetInnerHTML={MD(s.text)} /> : null}
          {points.length ? (
            <ul className="lp-ticks" style={{ borderTop: 0, paddingTop: 0, marginTop: 18 }}>
              {points.map((p) => (
                <li key={p}>
                  <LIcon name="check" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </Sec>
  );
}

function PostScript({ b }: { b: LandingBlock }) {
  const s = b.settings;
  return (
    <Sec b={b} narrow cls="lp-sp-tight">
      <div className="lp-ps">
        <div className="lp-ps__mark">{s.label}</div>
        <div>
          <div className="lp-md is-lg" dangerouslySetInnerHTML={MD(s.text)} />
          {s.cta_label && s.cta_url ? (
            <div className="lp-actions" style={{ marginTop: 24 }}>
              <Btn block={b} label={s.cta_label} href={s.cta_url} size="lg" />
            </div>
          ) : null}
        </div>
      </div>
    </Sec>
  );
}

function Faq({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const items = (s.items as S[]) ?? [];
  return (
    <Sec b={b} narrow>
      <Head s={s} />
      <div className="faq">
        {items.map((it, i) => (
          <details key={i}>
            <summary>{it.q}</summary>
            <div className="faq-a lp-md" dangerouslySetInnerHTML={MD(it.a)} />
          </details>
        ))}
      </div>
    </Sec>
  );
}

function Bonuses({ b }: { b: LandingBlock }) {
  const s = b.settings;
  const items = (s.items as S[]) ?? [];
  return (
    <Sec b={b} narrow>
      <Head s={s} />
      <div>
        {items.map((it, i) => (
          <div className="lp-bonus" key={i}>
            <div>
              <h3>{it.title}</h3>
              {it.text ? <p>{it.text}</p> : null}
            </div>
            {it.value ? <span className="lp-value">{it.value}</span> : null}
          </div>
        ))}
      </div>
      {s.total ? <p className="lp-total">{s.total}</p> : null}
    </Sec>
  );
}

function CountdownBlock({ b }: { b: LandingBlock }) {
  const s = b.settings;
  if (!s.target) return null;
  return (
    <Sec b={b} cls="lp-sp-tight">
      <Countdown target={s.target} label={s.label} doneText={s.done_text} />
    </Sec>
  );
}

/* -------------------------------------------------------------------------- */

export function RenderBlock({ block, first }: { block: LandingBlock; first: boolean }) {
  switch (block.type) {
    case "hero":
      return <Hero b={block} withImage={false} first={first} />;
    case "hero_image":
      return <Hero b={block} withImage first={first} />;
    case "cta":
      return <Cta b={block} />;
    case "buttons":
      return <Buttons b={block} />;
    case "form":
      return <FormBlock b={block} />;
    case "quote":
      return <Quote b={block} />;
    case "stats":
      return <Stats b={block} />;
    case "cards":
      return <Cards b={block} />;
    case "features":
      return <Features b={block} />;
    case "gallery":
      return <Gallery b={block} />;
    case "carousel":
      return <CarouselBlock b={block} />;
    case "video":
      return <Video b={block} />;
    case "audio":
      return <Audio b={block} />;
    case "pricing":
      return <Pricing b={block} />;
    case "testimonials":
      return <Testimonials b={block} />;
    case "guarantee":
      return <Guarantee b={block} />;
    case "ps":
      return <PostScript b={block} />;
    case "faq":
      return <Faq b={block} />;
    case "steps":
      return <Steps b={block} />;
    case "list":
      return <List b={block} />;
    case "compare":
      return <Compare b={block} />;
    case "bonuses":
      return <Bonuses b={block} />;
    case "bio":
      return <Bio b={block} />;
    case "logos":
      return <Logos b={block} />;
    case "countdown":
      return <CountdownBlock b={block} />;
    case "embed":
      return <Embed b={block} />;
    case "heading":
      return <Heading b={block} />;
    case "text":
      return <TextBlock b={block} />;
    case "image":
      return <ImageBlock b={block} />;
    case "divider":
      return <Divider b={block} />;
    case "spacer":
      return <div style={{ height: Number(block.settings.height) || 0 }} aria-hidden />;
  }
  return null;
}
