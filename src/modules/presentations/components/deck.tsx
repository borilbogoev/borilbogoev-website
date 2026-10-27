// Renderers of a deck: pure markup, no hooks and no browser APIs, so the same components draw the public page (on the server),
// the password-protected deck (in the browser, after unlock) and the builder canvas. All interaction (slides, steps, accordion,
// video, embeds, keys, touch) lives in controller.ts and attaches to the data attributes written here.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Monogram } from "@/components/monogram";
import { renderMarkdown } from "@/modules/forms/lib/markdown";
import { LIcon } from "@/modules/landing/components/icons";
import { parseVideo } from "@/modules/landing/lib/media";
import { embedAllowed, type DeckElement, type Settings } from "../lib/elements";
import type { DeckMode, DeckOrientation, DeckSettings } from "../lib/settings";
import { slideTitle, type DeckSlide } from "../lib/slides";
import { DeckForm } from "./deck-form";
import "./presentations.css";

type S = Settings;
type Img = { url?: string; width?: number; height?: number; variants?: { w: number; url: string }[] };

const MD = (text: unknown) => ({ __html: renderMarkdown(String(text ?? "")) });
const lines = (v: unknown) => String(v ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
const pad = (n: number) => String(n).padStart(2, "0");

/** A trailing full stop is the brand's signature: set it in red. */
function Dotted({ text, force }: { text: string; force?: boolean }) {
  const t = String(text ?? "");
  if (force || /[.?]$/.test(t)) {
    const mark = /[.?]$/.test(t) ? t.slice(-1) : ".";
    return (
      <>
        {/[.?]$/.test(t) ? t.slice(0, -1) : t}
        <span className="pr-dot">{mark}</span>
      </>
    );
  }
  return <>{t}</>;
}

function Pic({ img, alt = "", sizes, className, style, eager }: { img?: Img | null; alt?: string; sizes?: string; className?: string; style?: CSSProperties; eager?: boolean }) {
  if (!img?.url) return null;
  const srcSet = img.variants?.length ? img.variants.map((v) => `${v.url} ${v.w}w`).join(", ") : undefined;
  return (
    <img className={className} style={style} src={img.url} srcSet={srcSet} sizes={srcSet ? (sizes ?? "100vw") : undefined} width={img.width} height={img.height} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" />
  );
}

const Placeholder = ({ children }: { children: ReactNode }) => <div className="pr-ph">{children}</div>;

/* -------------------------------------------------------------------------- */
/* Elements                                                                   */
/* -------------------------------------------------------------------------- */

type Ctx = { editing: boolean; tone: "light" | "dark" };

function Heading({ s }: { s: S }) {
  if (!s.eyebrow && !s.text && !s.subtitle && !s.number) return null;
  const head = (
    <div className={`pr-head${s.number ? " has-num" : ""}`}>
      {s.number ? <p className="pr-num">{s.number}</p> : null}
      {s.eyebrow ? <p className={`pr-eyebrow${s.pill ? " is-pill" : ""}`}>{s.eyebrow}</p> : null}
      {s.text ? (
        <h2 className={`pr-h pr-h--${s.size}`}>
          <Dotted text={s.text} force={!!s.accent_dot} />
        </h2>
      ) : null}
      {s.subtitle ? <p className={`pr-sub pr-sub--${s.size}`}>{s.subtitle}</p> : null}
    </div>
  );
  return s.badge ? (
    <div className="pr-headrow">
      {head}
      <p className="pr-badge">{s.badge}</p>
    </div>
  ) : (
    head
  );
}

function Bullets({ s }: { s: S }) {
  const items = ((s.items as string[]) ?? []).filter(Boolean);
  return (
    <ul className={`pr-list pr-list--${s.marker} pr-list--${s.size} pr-cols-${s.columns}`} data-build-items={s.build_items ? "" : undefined}>
      {items.map((t, i) => (
        <li key={i}>
          {s.marker === "check" ? <LIcon name="check" size={22} className="pr-check" /> : null}
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function ImageEl({ s, c }: { s: S; c: Ctx }) {
  const img = s.image as Img;
  if (!img?.url) return c.editing ? <Placeholder>Add a picture</Placeholder> : null;
  return (
    <figure className={`pr-fig pr-fig--${s.shape} pr-fit--${s.fit}${s.mono ? " is-mono" : ""}${s.scale === "small" ? " is-small" : ""}`}>
      <Pic img={img} alt={s.alt} sizes="(min-width: 900px) 50vw, 100vw" />
      {s.caption ? <figcaption>{s.caption}</figcaption> : null}
    </figure>
  );
}

function Gallery({ s, c }: { s: S; c: Ctx }) {
  const items = ((s.items as S[]) ?? []).filter((i) => i.image?.url);
  if (!items.length) return c.editing ? <Placeholder>Add pictures</Placeholder> : null;
  return (
    <div className={`pr-gallery pr-gallery--${s.style || "plain"} pr-cols-${s.columns}${s.mono ? " is-mono" : ""}`}>
      {items.map((it, i) => (
        <figure key={i} className="pr-fig pr-fig--rounded pr-fit--cover">
          <Pic img={it.image} alt={it.alt} sizes="(min-width: 900px) 50vw, 100vw" />
          {it.caption ? <figcaption>{it.caption}</figcaption> : null}
        </figure>
      ))}
    </div>
  );
}

function VideoEl({ s, c }: { s: S; c: Ctx }) {
  const source = s.url ? parseVideo(s.url) : null;
  if (!source) return c.editing ? <Placeholder>Paste a YouTube, Vimeo, Loom or MP4 link</Placeholder> : null;
  const poster = s.poster as Img;
  const [w, h] = String(s.ratio).split(":").map(Number);
  return (
    <figure className="pr-video-wrap">
      <div className="pr-video" style={{ aspectRatio: `${w || 16} / ${h || 9}`, "--r": (w || 16) / (h || 9) } as CSSProperties}>
        <button type="button" className="pr-video__btn" data-video-kind={source.kind} data-video-id={source.id} data-video-src={source.src} data-video-title={s.title || "Video"} data-video-poster={poster?.url || undefined} aria-label={`Play video: ${s.title || "Video"}`}>
          {poster?.url ? <Pic img={poster} sizes="100vw" /> : null}
          <span className="pr-play">
            <LIcon name="play" size={34} />
          </span>
        </button>
      </div>
      {s.caption ? <figcaption>{s.caption}</figcaption> : null}
    </figure>
  );
}

function EmbedEl({ s, c }: { s: S; c: Ctx }) {
  const href = String(s.url ?? "");
  if (!href) return c.editing ? <Placeholder>Add the page address</Placeholder> : null;
  if (!embedAllowed(href)) return <Placeholder>This address cannot be embedded. Check the list of allowed hosts in the element settings.</Placeholder>;
  const host = href.startsWith("/") ? "this site" : new URL(href).hostname.replace(/^www\./, "");
  const fixed = s.mode === "fixed";
  return (
    <div className={`pr-embed${fixed ? " is-fixed" : ""}`} style={fixed ? { height: `${Number(s.height) || 560}px` } : undefined}>
      {c.editing ? (
        <Placeholder>Interactive page · {host}</Placeholder>
      ) : (
        <iframe
          data-src={href}
          title={s.title || "Interactive demo"}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-modals"
          allow="fullscreen; clipboard-write; autoplay; microphone; camera"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
      {s.open_link && !c.editing ? (
        <a className="pr-embed__open" href={href} target="_blank" rel="noopener noreferrer">
          Open in a new tab <LIcon name="external" size={14} />
        </a>
      ) : null}
    </div>
  );
}

function QuoteEl({ s }: { s: S }) {
  if (!s.quote) return null;
  const statement = s.size === "statement";
  return (
    <blockquote className={`pr-quote pr-quote--${s.size}`}>
      <span className="pr-qmark" aria-hidden="true">
        “
      </span>
      <p>{statement ? <Dotted text={String(s.quote)} /> : s.quote}</p>
      {s.author || s.role ? (
        <footer>
          {s.author ? <strong>{s.author}</strong> : null}
          {s.role ? <span>{s.role}</span> : null}
        </footer>
      ) : null}
    </blockquote>
  );
}

function Stats({ s }: { s: S }) {
  const items = (s.items as S[]) ?? [];
  return (
    <div className="pr-stats" style={{ "--n": Math.max(1, Math.min(items.length, 4)) } as CSSProperties}>
      {items.map((it, i) => (
        <div key={i} className="pr-stat">
          <strong>
            {it.prefix ? <span className="pr-stat__fix">{it.prefix}</span> : null}
            {it.value}
            {it.suffix ? <span className="pr-stat__fix is-red">{it.suffix}</span> : null}
          </strong>
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function Steps({ s }: { s: S }) {
  const items = (s.items as S[]) ?? [];
  return (
    <ol className={`pr-steps pr-steps--${s.layout}${s.style === "big" ? " is-big" : ""}`} data-build-items={s.build_items ? "" : undefined} style={{ "--n": Math.max(1, Math.min(items.length, 5)) } as CSSProperties}>
      {items.map((it, i) => (
        <li key={i}>
          <span className="pr-step__n">{pad(i + 1)}</span>
          <div className="pr-step__t">
            <h3>{it.title}</h3>
            {it.text ? <p>{it.text}</p> : null}
          </div>
          {it.meta ? <span className="pr-step__m">{it.meta}</span> : null}
        </li>
      ))}
    </ol>
  );
}

function Cards({ s }: { s: S }) {
  const items = (s.items as S[]) ?? [];
  const compact = s.style === "compact";
  return (
    <ul className={`pr-cards pr-cols-${s.columns}${compact ? " is-compact" : ""}${compact && s.size === "lg" ? " is-lg" : ""}`} data-build-items={s.build_items ? "" : undefined}>
      {items.map((it, i) => (
        <li key={i} className="pr-card">
          <div className="pr-card__head">
            <span className="pr-well">
              <LIcon name={it.icon || "check"} size={compact ? 32 : 22} />
            </span>
            <h3>
              {it.num ? <span className="pr-card__n">{it.num}</span> : null}
              {it.num ? " " : null}
              {it.title}
            </h3>
          </div>
          {it.text ? <p>{it.text}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function Panels({ s }: { s: S }) {
  const items = (s.items as S[]) ?? [];
  return (
    <div className="pr-boxes" style={{ "--n": items.length } as CSSProperties}>
      {items.map((it, i) => (
        <section key={i} className={`pr-box is-${it.tone}${it.title_size === "lg" ? " has-lg" : ""}`}>
          {it.label ? <p className={`pr-box__label${it.label_red ? " is-red" : ""}`}>{it.label}</p> : null}
          {it.title ? (
            <h3 className={`pr-box__title pr-box__title--${it.title_size}`}>
              <Dotted text={String(it.title)} force={it.title_size === "lg"} />
            </h3>
          ) : null}
          {it.text ? <div className="pr-md pr-box__text" dangerouslySetInnerHTML={MD(it.text)} /> : null}
          {it.note ? <p className="pr-box__note">{it.note}</p> : null}
        </section>
      ))}
    </div>
  );
}

function Pricing({ s }: { s: S }) {
  const items = (s.items as S[]) ?? [];
  return (
    <div className="pr-pricing" style={{ "--n": items.length } as CSSProperties}>
      {items.map((it, i) => {
        const star = String(it.name ?? "").endsWith("*");
        const name = star ? String(it.name).slice(0, -1) : String(it.name ?? "");
        return (
          <section key={i} className={`pr-plan is-${it.tone}`}>
            <div className="pr-plan__top">
              <p className="pr-plan__step">{it.step}</p>
              {it.badge ? <p className="pr-plan__badge">{it.badge}</p> : null}
            </div>
            <h3 className="pr-plan__name">
              {name}
              {star ? <span className="pr-dot">*</span> : null}
            </h3>
            {it.tagline ? <p className="pr-plan__tag">{it.tagline}</p> : null}
            <p className="pr-plan__price">
              {it.price}
              {it.unit ? <span> {it.unit}</span> : null}
            </p>
            {it.old_price ? <p className="pr-plan__old">{it.old_price}</p> : null}
            {it.note ? <p className="pr-plan__note">{it.note}</p> : null}
            <hr />
            <ul className="pr-plan__list">
              {((it.features as string[]) ?? []).filter(Boolean).map((f, j) => (
                <li key={j}>
                  <LIcon name="check" size={28} className="pr-check" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {it.chip ? <p className="pr-plan__chip">{it.chip}</p> : null}
          </section>
        );
      })}
    </div>
  );
}

function Bars({ s }: { s: S }) {
  const items = ((s.items as S[]) ?? []).map((it) => ({ label: String(it.label ?? ""), shown: String(it.value ?? ""), n: parseFloat(String(it.value ?? "").replace(",", ".")) || 0 }));
  if (!items.length) return null;
  const max = Math.max(...items.map((i) => i.n), 1);
  const top = Number(s.highlight) || 0;
  return (
    <ul className="pr-bars">
      {items.map((it, i) => (
        <li key={i} className={i < top ? "is-top" : ""}>
          <p className="pr-bars__label">{it.label}</p>
          <div className="pr-bars__row">
            <div className="pr-bars__track" role="img" aria-label={`${it.label}: ${it.shown}`}>
              <i style={{ width: `${Math.max(1, Math.round((it.n / max) * 1000) / 10)}%` }} />
            </div>
            <p className="pr-bars__value">{it.shown}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Tags({ s }: { s: S }) {
  const items = ((s.items as S[]) ?? []).filter((i) => i.text);
  if (!items.length) return null;
  return (
    <ul className="pr-tags">
      {items.map((it, i) => (
        <li key={i} className={it.tone === "red" ? "is-red" : ""}>
          {it.text}
        </li>
      ))}
    </ul>
  );
}

function Callout({ s }: { s: S }) {
  if (!s.lead && !s.text) return null;
  return (
    <div className="pr-callout">
      <LIcon name="bulb" size={36} className="pr-callout__i" />
      <p>
        {s.lead ? <strong>{s.lead}</strong> : null}
        {s.lead && s.text ? " " : null}
        {s.text}
      </p>
    </div>
  );
}

function Compare({ s }: { s: S }) {
  const side = (title: string, list: unknown, mark: "minus" | "check", cls: string) => (
    <div className={`pr-side ${cls}`}>
      <h3>{title}</h3>
      <ul>
        {((list as string[]) ?? []).map((t, i) => (
          <li key={i}>
            <LIcon name={mark} size={20} className="pr-check" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div className="pr-compare">
      {side(s.left_title, s.left_items, "minus", "is-before")}
      {side(s.right_title, s.right_items, "check", "is-after")}
    </div>
  );
}

function Code({ s }: { s: S }) {
  if (!s.code) return null;
  return (
    <figure className={`pr-code pr-code--${s.size}`}>
      {s.label ? <figcaption>{s.label}</figcaption> : null}
      <pre>
        <code>{s.code}</code>
      </pre>
    </figure>
  );
}

function Table({ s }: { s: S }) {
  const rows = lines(s.rows).map((r) => r.split("|").map((c) => c.trim()));
  if (!rows.length) return null;
  const head = s.header ? rows[0] : null;
  const body = s.header ? rows.slice(1) : rows;
  return (
    <div className={`pr-table-wrap pr-table--${s.size}`}>
      <table className="pr-table">
        {head ? (
          <thead>
            <tr>
              {head.map((c, i) => (
                <th key={i} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {body.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Logos({ s }: { s: S }) {
  const items = (s.items as S[]) ?? [];
  if (!items.length) return null;
  return (
    <div className="pr-logos">
      {s.label ? <p className="pr-eyebrow">{s.label}</p> : null}
      <ul>
        {items.map((it, i) => (
          <li key={i}>{it.image?.url ? <Pic img={it.image} alt={it.name} sizes="240px" /> : <span>{it.name}</span>}</li>
        ))}
      </ul>
    </div>
  );
}

function Person({ s }: { s: S }) {
  const img = s.image as Img;
  const creds = ((s.credentials as string[]) ?? []).filter(Boolean);
  return (
    <div className="pr-person">
      {img?.url ? (
        <div className="pr-fig pr-fig--circle pr-person__img">
          <Pic img={img} alt={s.image_alt} sizes="320px" />
        </div>
      ) : null}
      <div>
        {s.role ? <p className="pr-eyebrow">{s.role}</p> : null}
        {s.name ? <h3>{s.name}</h3> : null}
        {s.text ? <div className="pr-md" dangerouslySetInnerHTML={MD(s.text)} /> : null}
        {creds.length ? (
          <ul className="pr-list pr-list--dot pr-list--md pr-cols-1">
            {creds.map((t, i) => (
              <li key={i}>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function ButtonEl({ s, c }: { s: S; c: Ctx }) {
  if (!s.label) return null;
  const cls = `pr-btn pr-btn--${s.style}`;
  if (c.editing || !s.url) return <span className={cls}>{s.label}</span>;
  const external = /^https?:\/\//i.test(s.url) && !s.url.startsWith("https://borilbogoev.com");
  return (
    <a className={cls} href={s.url} target={s.new_tab ? "_blank" : undefined} rel={s.new_tab || external ? "noopener noreferrer" : undefined}>
      {s.label}
      {s.new_tab ? <LIcon name="external" size={16} /> : null}
    </a>
  );
}

function FormEl({ s, c }: { s: S; c: Ctx }) {
  const id = Number(s.form_id);
  if (!id) return c.editing ? <Placeholder>Choose a form</Placeholder> : null;
  if (c.editing) return <Placeholder>Form #{id}</Placeholder>;
  return (
    <div className="pr-form">
      <DeckForm id={id} display={s.display === "modal" ? "modal" : "inline"} label={s.button_label || "Register Now"} theme={c.tone} />
    </div>
  );
}

function Divider({ s }: { s: S }) {
  const w = Math.max(5, Math.min(100, Number(s.width) || 100));
  const spacing = Math.max(0, Number(s.spacing) || 0);
  if (s.style === "accent") return <div className="pr-hr-accent" style={{ margin: `${spacing / 16}em 0` }} aria-hidden="true" />;
  if (s.style === "dots") return <div className="pr-hr-dots" style={{ margin: `${spacing / 16}em 0` }} aria-hidden="true">···</div>;
  return <hr className="pr-hr" style={{ borderTopStyle: s.style as CSSProperties["borderTopStyle"], borderTopColor: s.color, borderTopWidth: Math.max(1, Number(s.thickness) || 1), width: `${w}%`, margin: `${spacing / 16}em 0` }} />;
}

function ElementView({ el, c }: { el: DeckElement; c: Ctx }) {
  const s = el.settings;
  let body: ReactNode = null;
  switch (el.type) {
    case "heading":
      body = <Heading s={s} />;
      break;
    case "text":
      body = s.content ? <div className={`pr-md pr-text--${s.size} is-${s.tone}`} dangerouslySetInnerHTML={MD(s.content)} /> : null;
      break;
    case "bullets":
      body = <Bullets s={s} />;
      break;
    case "image":
      body = <ImageEl s={s} c={c} />;
      break;
    case "gallery":
      body = <Gallery s={s} c={c} />;
      break;
    case "video":
      body = <VideoEl s={s} c={c} />;
      break;
    case "embed":
      body = <EmbedEl s={s} c={c} />;
      break;
    case "quote":
      body = <QuoteEl s={s} />;
      break;
    case "stats":
      body = <Stats s={s} />;
      break;
    case "steps":
      body = <Steps s={s} />;
      break;
    case "cards":
      body = <Cards s={s} />;
      break;
    case "compare":
      body = <Compare s={s} />;
      break;
    case "panels":
      body = <Panels s={s} />;
      break;
    case "pricing":
      body = <Pricing s={s} />;
      break;
    case "bars":
      body = <Bars s={s} />;
      break;
    case "tags":
      body = <Tags s={s} />;
      break;
    case "callout":
      body = <Callout s={s} />;
      break;
    case "code":
      body = <Code s={s} />;
      break;
    case "table":
      body = <Table s={s} />;
      break;
    case "logos":
      body = <Logos s={s} />;
      break;
    case "person":
      body = <Person s={s} />;
      break;
    case "button":
      body = <ButtonEl s={s} c={c} />;
      break;
    case "form":
      body = <FormEl s={s} c={c} />;
      break;
    case "divider":
      body = <Divider s={s} />;
      break;
    case "spacer":
      body = <div style={{ height: `${(Number(s.height) || 0) / 16}em` }} aria-hidden="true" />;
      break;
  }
  if (!body) return null;
  return (
    <div className={`pr-el pr-el--${el.type}`} data-build={s.build === "click" ? "click" : undefined} data-align={s.align || undefined} data-el={c.editing ? el.id : undefined}>
      {body}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Slide                                                                      */
/* -------------------------------------------------------------------------- */

function Motif({ variant = "" }: { variant?: string }) {
  // The brand's asterisk, drawn once, large, in the one red.
  return (
    <svg className={`pr-motif${variant ? ` pr-motif--${variant}` : ""}`} viewBox="1380 -1500 840 840" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M1693.6 -652H1903.6L1883.6 -923L2109.6 -770L2214.6 -952L1970.6 -1070L2214.6 -1188L2109.6 -1372L1883.6 -1219L1903.6 -1490H1693.6L1714.6 -1219L1488.6 -1372L1382.6 -1188L1628.6 -1070L1382.6 -952L1488.6 -770L1714.6 -923Z" />
    </svg>
  );
}

export function SlideView({ slide, index, total, active = false, open = false, editing = false, presenter = false, deckDark = false }: { slide: DeckSlide; index: number; total: number; active?: boolean; open?: boolean; editing?: boolean; presenter?: boolean; deckDark?: boolean }) {
  const s = slide.settings;
  const bg = String(s.bg);
  const tone: "light" | "dark" = bg === "image" || bg === "accent" ? "dark" : bg === "inverse" ? (deckDark ? "light" : "dark") : deckDark ? "dark" : "light";
  const c: Ctx = { editing, tone };
  const split = String(s.layout).startsWith("split");
  const render = (list: DeckElement[]) => list.map((el, i) => <ElementView key={el.id || i} el={el} c={c} />);
  const top = slide.elements.filter((e) => e.settings.col === "all");
  const left = slide.elements.filter((e) => e.settings.col === "1");
  const right = slide.elements.filter((e) => e.settings.col === "2");
  const bgImg = s.bg_image as Img;
  const title = slideTitle(slide);
  const id = s.anchor ? String(s.anchor) : `s${index + 1}`;
  return (
    <section
      id={id}
      className={`pr-slide${active ? " is-active" : ""}`}
      data-i={index}
      data-bg={bg}
      data-tone={tone}
      data-kind={slide.kind}
      data-layout={s.layout}
      data-align={s.align}
      data-valign={s.valign}
      data-pad={s.pad === "tight" ? "tight" : undefined}
      data-open={open ? "1" : "0"}
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${total}: ${title}`}
    >
      <button type="button" className="pr-acc" aria-expanded={open} aria-controls={`${id}-body`}>
        <span className="pr-acc__n">{pad(index + 1)}</span>
        <span className="pr-acc__t">
          <strong>{title}</strong>
          {s.summary ? <small>{s.summary}</small> : null}
        </span>
        <span className="pr-acc__i" aria-hidden="true" />
      </button>
      <div className="pr-slide__body" id={`${id}-body`}>
        {bg === "image" && bgImg?.url ? (
          <div className={`pr-bgimg${s.bg_mono ? " is-mono" : ""}`} aria-hidden="true">
            <Pic img={bgImg} sizes="100vw" eager={index === 0} />
            <i style={{ opacity: Math.max(0, Math.min(90, Number(s.bg_dim) || 0)) / 100 }} />
          </div>
        ) : null}
        <div className={`pr-in${split ? " is-split" : ""}`} data-split={split ? String(s.layout) : undefined}>
          {split ? (
            <>
              {top.length ? <div className="pr-top">{render(top)}</div> : null}
              <div className="pr-cols">
                <div className="pr-col">{render(left)}</div>
                <div className="pr-col">{render(right)}</div>
              </div>
            </>
          ) : (
            <div className="pr-col">{render(slide.elements)}</div>
          )}
        </div>
        {s.motif === "asterisk" ? <Motif /> : s.motif === "asterisk_xl" ? <Motif variant="xl" /> : s.motif === "asterisk_corner" ? <Motif variant="corner" /> : null}
      </div>
      {presenter && s.notes ? (
        <aside className="pr-notes-src" hidden>
          {s.notes}
        </aside>
      ) : null}
    </section>
  );
}

/** One slide as a miniature, for the builder canvas. Same CSS as the real deck. */
export function SlideThumb({ slide, index, total, orientation, deckDark, mode, large = false }: { slide: DeckSlide; index: number; total: number; orientation: DeckOrientation; deckDark: boolean; mode: DeckMode; large?: boolean }) {
  return (
    <div className="pr pr-edit" data-mode={mode === "accordion" ? "edit-accordion" : "slides"} data-orient={orientation === "portrait" ? "portrait" : "landscape"} data-theme={deckDark ? "dark" : "light"} data-scale={large ? "large" : "standard"}>
      <div className="pr-frame">
        <SlideView slide={slide} index={index} total={total} active open editing deckDark={deckDark} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The deck                                                                   */
/* -------------------------------------------------------------------------- */

const CHROME: Record<string, ReactNode> = {
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  rows: (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1.5" />
      <rect x="3" y="11" width="18" height="5" rx="1.5" />
      <path d="M3 19h18" />
    </>
  ),
  slides: <rect x="3" y="5" width="18" height="14" rx="2" />,
  notes: (
    <>
      <path d="M5 4h14v16H5z" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01" />
    </>
  ),
};

function CIcon({ name }: { name: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {CHROME[name]}
    </svg>
  );
}

export type DeckViewDeck = { id: number; title: string; slug: string; mode: DeckMode; orientation: DeckOrientation; settings: DeckSettings };

export function DeckView({ deck, slides, presenter = false, track = false, unlockToken }: { deck: DeckViewDeck; slides: DeckSlide[]; presenter?: boolean; track?: boolean; unlockToken?: string }) {
  const s = deck.settings;
  const shown = slides.filter((x) => !x.settings.hidden);
  const dark = s.theme === "dark";
  const accordion = deck.mode === "accordion";
  const first = shown[0];
  const tone = first ? (first.settings.bg === "image" || first.settings.bg === "inverse" ? (dark && first.settings.bg === "inverse" ? "light" : "dark") : dark ? "dark" : "light") : dark ? "dark" : "light";
  return (
    <div
      className="pr"
      lang={s.lang}
      data-mode={deck.mode}
      data-orient={deck.orientation}
      data-theme={s.theme}
      data-scale={s.scale}
      data-transition={s.transition}
      data-tone={tone}
      data-total={shown.length}
      data-switch={s.allow_switch ? "1" : "0"}
      data-multi={s.accordion_multi ? "1" : "0"}
      data-autoplay={s.autoplay || undefined}
      data-loop={s.loop ? "1" : "0"}
      data-presenter={presenter ? "1" : "0"}
      data-pid={track && s.track ? deck.id : undefined}
      data-slug={deck.slug}
      data-token={unlockToken}
    >
      <h1 className="pr-sr">{deck.title}</h1>

      <header className="pr-top-bar">
        <Link className="pr-brand" href="/" aria-label="Boril Bogoev, home">
          <span className="pr-mono-light">
            <Monogram height={26} />
          </span>
          <span className="pr-mono-dark">
            <Monogram height={26} inverse />
          </span>
        </Link>
        <div className="pr-tools">
          {s.outline ? (
            <button type="button" data-act="outline" aria-label="Contents" aria-expanded="false" title="Contents (O)">
              <CIcon name="menu" />
            </button>
          ) : null}
          {s.allow_switch ? (
            <button type="button" data-act="mode" aria-label={accordion ? "Show as slides" : "Show as accordion"} title="Slides or accordion (M)">
              <span className="pr-ic-rows">
                <CIcon name="rows" />
              </span>
              <span className="pr-ic-slides">
                <CIcon name="slides" />
              </span>
            </button>
          ) : null}
          {presenter ? (
            <button type="button" data-act="notes" aria-label="Speaker notes" aria-pressed="false" title="Speaker notes (N)">
              <CIcon name="notes" />
            </button>
          ) : null}
          <button type="button" data-act="help" aria-label="Keyboard shortcuts" title="Shortcuts (?)">
            <CIcon name="help" />
          </button>
        </div>
      </header>

      <main className="pr-stage" id="pr-main">
        <div className="pr-frame">
          <div className="pr-intro">
            <p className="pr-eyebrow">Presentation</p>
            <p className="pr-intro__t">
              <Dotted text={deck.title} force />
            </p>
            {s.subtitle ? <p className="pr-sub">{s.subtitle}</p> : null}
            <div className="pr-intro__bar">
              <button type="button" data-act="expand">
                Expand all
              </button>
              <button type="button" data-act="collapse">
                Collapse all
              </button>
            </div>
          </div>
          {shown.map((sl, i) => (
            <SlideView key={sl.id || i} slide={sl} index={i} total={shown.length} active={i === 0} open={sl.settings.open ? true : false} presenter={presenter} deckDark={dark} />
          ))}
          {!shown.length ? <p className="pr-empty">This presentation has no slides yet.</p> : null}
        </div>
      </main>

      {s.footer !== "none" ? (
        <footer className="pr-foot">
          {s.footer === "brand" ? (
            <span className="pr-foot__mark" aria-hidden="true">
              <span className="pr-mono-light">
                <Monogram height={18} />
              </span>
              <span className="pr-mono-dark">
                <Monogram height={18} inverse />
              </span>
            </span>
          ) : (
            <span />
          )}
          {s.counter ? (
            <span className="pr-count" aria-live="polite" aria-atomic="true">
              <b data-count-now>01</b> / <span data-count-total>{pad(shown.length)}</span>
            </span>
          ) : null}
        </footer>
      ) : null}

      {s.arrows ? (
        <nav className="pr-nav" aria-label="Slides">
          <button type="button" data-act="prev" aria-label="Previous slide">
            <LIcon name="left" size={22} />
          </button>
          <button type="button" data-act="next" aria-label="Next slide">
            <LIcon name="right" size={22} />
          </button>
        </nav>
      ) : null}

      {s.progress ? (
        <div className="pr-progress" aria-hidden="true">
          <i data-progress />
        </div>
      ) : null}

      <aside className="pr-panel pr-outline" hidden aria-label="Contents">
        <div className="pr-panel__head">
          <span className="pr-eyebrow">Contents</span>
          <button type="button" data-act="outline" aria-label="Close contents">
            <CIcon name="close" />
          </button>
        </div>
        <ol>
          {shown.map((sl, i) => (
            <li key={i}>
              <button type="button" data-go={i} className={sl.kind === "section" ? "is-section" : ""}>
                <span>{pad(i + 1)}</span>
                {slideTitle(sl)}
              </button>
            </li>
          ))}
        </ol>
      </aside>

      {presenter ? (
        <aside className="pr-panel pr-notes" hidden aria-label="Speaker notes">
          <div className="pr-panel__head">
            <span className="pr-eyebrow">Speaker notes · only you see this</span>
            <button type="button" data-act="notes" aria-label="Close notes">
              <CIcon name="close" />
            </button>
          </div>
          <p data-notes-text />
        </aside>
      ) : null}

      <div className="pr-help" hidden role="dialog" aria-label="Keyboard shortcuts">
        <div>
          <div className="pr-panel__head">
            <span className="pr-eyebrow">Shortcuts</span>
            <button type="button" data-act="help" aria-label="Close shortcuts">
              <CIcon name="close" />
            </button>
          </div>
          <dl>
            <dt>Next</dt>
            <dd>Right arrow · Space · Page Down</dd>
            <dt>Previous</dt>
            <dd>Left arrow · Page Up</dd>
            <dt>First · last</dt>
            <dd>Home · End</dd>
            <dt>Contents</dt>
            <dd>O</dd>
            <dt>Slides or accordion</dt>
            <dd>M</dd>
            {presenter ? (
              <>
                <dt>Speaker notes</dt>
                <dd>N</dd>
              </>
            ) : null}
            <dt>Close a panel</dt>
            <dd>Esc</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
