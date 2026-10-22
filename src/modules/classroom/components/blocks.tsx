"use client";

// Renderers of every lesson block. The same components draw the lesson for a student and the canvas of the builder
// (`editing`: interactive blocks are shown but save nothing). Content blocks are plain markup; the learning blocks
// (checklist, question box, flashcards) keep the student's state through the context below.
import { createContext, memo, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { renderMarkdown } from "@/modules/forms/lib/markdown";
import { LIcon } from "@/modules/landing/components/icons";
import { embedAllowed, type BlockType, type Settings } from "../lib/blocks";
import "./classroom.css";

type S = Settings;
type Img = { url?: string; width?: number; height?: number; variants?: { w: number; url: string }[] };
export type PlayerBlock = { id: number; type: BlockType; settings: Settings };

export type BlockContext = {
  /** Builder canvas: blocks look as they will, nothing is saved. */
  editing: boolean;
  signedIn: boolean;
  /** The student's saved state per block id. */
  state: Record<number, S>;
  /** Votes per option of the polls this student has answered (only when the poll shows results). */
  results: Record<number, number[]>;
  /** Saves the student's state in a block. Polls answer with the results. */
  save: (blockId: number, data: S) => Promise<{ data?: S; results?: number[] } | void>;
};

export const BlockCtx = createContext<BlockContext>({ editing: false, signedIn: false, state: {}, results: {}, save: async () => {} });

const MD = (text: unknown) => ({ __html: renderMarkdown(String(text ?? "")) });
const lines = (v: unknown) => String(v ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

/* -------------------------------------------------------------------------- */
/* Small parts                                                                */
/* -------------------------------------------------------------------------- */

function Pic({ img, alt = "", sizes, className }: { img?: Img | null; alt?: string; sizes?: string; className?: string }) {
  if (!img?.url) return null;
  const srcSet = img.variants?.length ? img.variants.map((v) => `${v.url} ${v.w}w`).join(", ") : undefined;
  return <img className={className} src={img.url} srcSet={srcSet} sizes={srcSet ? sizes : undefined} width={img.width || undefined} height={img.height || undefined} alt={alt} loading="lazy" decoding="async" />;
}

const Placeholder = ({ children }: { children: ReactNode }) => <div className="cr-ph">{children}</div>;

/** A trailing full stop is the brand's signature: set it in red. */
function Dotted({ text, force }: { text: string; force?: boolean }) {
  const t = String(text ?? "");
  if (force || t.endsWith(".")) return (
    <>
      {t.replace(/\.$/, "")}
      <span className="cr-dot">.</span>
    </>
  );
  return <>{t}</>;
}

/* -------------------------------------------------------------------------- */
/* Content blocks                                                             */
/* -------------------------------------------------------------------------- */

function Heading({ s }: { s: S }) {
  if (!s.text) return null;
  const big = s.size === "display" || s.size === "display_lg";
  const Tag = s.size === "h2" ? "h3" : "h2";
  return (
    <header className={`cr-heading cr-heading--${s.size}`}>
      {s.eyebrow ? <p className="cr-eyebrow">{s.eyebrow}</p> : null}
      <Tag>
        <Dotted text={s.text} force={!!s.accent_dot && !String(s.text).endsWith(".")} />
      </Tag>
      {s.subtitle ? <p className={big ? "cr-sub cr-sub--lg" : "cr-sub"}>{s.subtitle}</p> : null}
    </header>
  );
}

function Text({ s }: { s: S }) {
  if (!s.content) return null;
  return <div className={`cr-prose cr-prose--${s.size} cr-tone--${s.tone}`} dangerouslySetInnerHTML={MD(s.content)} />;
}

function Bullets({ s }: { s: S }) {
  const items = (s.items as string[]) ?? [];
  if (!items.length) return null;
  const Tag = s.marker === "number" ? "ol" : "ul";
  return (
    <Tag className={`cr-list cr-list--${s.marker} cr-list--${s.size}${String(s.columns) === "2" ? " cr-list--2" : ""}`}>
      {items.map((t, i) => (
        <li key={i}>
          {s.marker === "check" ? <LIcon name="check" size={18} className="cr-list__icon" /> : null}
          <span dangerouslySetInnerHTML={MD(t)} />
        </li>
      ))}
    </Tag>
  );
}

function Quote({ s }: { s: S }) {
  if (!s.quote) return null;
  return (
    <blockquote className={`cr-quote cr-quote--${s.size}`}>
      <p>{s.quote}</p>
      {s.author || s.role ? (
        <footer>
          {s.author ? <strong>{s.author}</strong> : null}
          {s.role ? <span>{s.role}</span> : null}
        </footer>
      ) : null}
    </blockquote>
  );
}

function Callout({ s }: { s: S }) {
  if (!s.content && !s.title) return null;
  const icon = ({ takeaway: "spark", tip: "check", warning: "shield", example: "book" } as Record<string, string>)[s.kind] ?? "spark";
  const label = ({ takeaway: "Key takeaway", tip: "Tip", warning: "Watch out", example: "Example" } as Record<string, string>)[s.kind] ?? "Note";
  return (
    <aside className={`cr-callout cr-callout--${s.kind}`}>
      <span className="cr-callout__icon">
        <LIcon name={icon} size={20} />
      </span>
      <div>
        <p className="cr-callout__label">{s.title || label}</p>
        {s.content ? <div className="cr-prose" dangerouslySetInnerHTML={MD(s.content)} /> : null}
      </div>
    </aside>
  );
}

function ImageBlock({ s, ctx }: { s: S; ctx: BlockContext }) {
  const img = s.image as Img;
  if (!img?.url) return ctx.editing ? <Placeholder>Choose a picture</Placeholder> : null;
  return (
    <figure className={`cr-figure cr-figure--${s.shape}`}>
      <div className={`cr-figure__frame${s.mono ? " is-mono" : ""}`}>
        <Pic img={img} alt={s.alt || ""} sizes="(min-width: 1100px) 760px, 100vw" className={s.fit === "cover" ? "is-cover" : ""} />
      </div>
      {s.caption ? <figcaption>{s.caption}</figcaption> : null}
    </figure>
  );
}

function Gallery({ s, ctx }: { s: S; ctx: BlockContext }) {
  const items = ((s.items as S[]) ?? []).filter((i) => i.image?.url);
  if (!items.length) return ctx.editing ? <Placeholder>Add pictures to the grid</Placeholder> : null;
  return (
    <div className={`cr-gallery cr-gallery--${s.columns}`}>
      {items.map((i, n) => (
        <figure key={n} className={`cr-figure${s.mono ? " is-mono" : ""}`}>
          <div className="cr-figure__frame">
            <Pic img={i.image} alt={i.alt || ""} sizes="(min-width: 1100px) 250px, 50vw" />
          </div>
          {i.caption ? <figcaption>{i.caption}</figcaption> : null}
        </figure>
      ))}
    </div>
  );
}

function Steps({ s }: { s: S }) {
  const items = (s.items as S[]) ?? [];
  if (!items.length) return null;
  return (
    <ol className={`cr-steps cr-steps--${s.layout}`}>
      {items.map((i, n) => (
        <li key={n}>
          <span className="cr-steps__n">{String(n + 1).padStart(2, "0")}</span>
          <div>
            <h3>{i.title}</h3>
            {i.text ? <p>{i.text}</p> : null}
            {i.meta ? <small>{i.meta}</small> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Cards({ s }: { s: S }) {
  const items = (s.items as S[]) ?? [];
  if (!items.length) return null;
  return (
    <div className={`cr-cards cr-cards--${s.columns}`}>
      {items.map((i, n) => (
        <div key={n} className="cr-card">
          <span className="cr-card__icon">
            <LIcon name={i.icon || "check"} size={20} />
          </span>
          <h3>{i.title}</h3>
          {i.text ? <p>{i.text}</p> : null}
        </div>
      ))}
    </div>
  );
}

function Compare({ s }: { s: S }) {
  const col = (title: string, list: string[], tone: string) => (
    <div className={`cr-compare__col cr-compare__col--${tone}`}>
      <h3>{title}</h3>
      <ul>
        {list.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
  return (
    <div className="cr-compare">
      {col(s.left_title, (s.left_items as string[]) ?? [], "left")}
      {col(s.right_title, (s.right_items as string[]) ?? [], "right")}
    </div>
  );
}

function Table({ s }: { s: S }) {
  const rows = lines(s.rows).map((r) => r.split("|").map((c) => c.trim()));
  if (!rows.length) return null;
  const head = s.header ? rows[0] : null;
  const body = s.header ? rows.slice(1) : rows;
  return (
    <div className={`cr-table-wrap cr-table--${s.size}`}>
      <table className="cr-table">
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

function Code({ s }: { s: S }) {
  const [copied, setCopied] = useState(false);
  if (!s.code) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(s.code));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the text can still be selected by hand */
    }
  };
  return (
    <figure className={`cr-code cr-code--${s.size}`}>
      <figcaption>
        <span>{s.label || "Prompt"}</span>
        <button type="button" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </figcaption>
      <pre>
        <code>{s.code}</code>
      </pre>
    </figure>
  );
}

function Divider({ s }: { s: S }) {
  const w = Math.max(5, Math.min(100, Number(s.width) || 100));
  const spacing = Math.max(0, Number(s.spacing) || 0);
  const margin = `${spacing / 16}em 0`;
  if (s.style === "accent") return <div className="cr-hr-accent" style={{ margin }} aria-hidden="true" />;
  if (s.style === "dots") return <div className="cr-hr-dots" style={{ margin }} aria-hidden="true">···</div>;
  return <hr className="cr-hr" style={{ borderTopStyle: s.style as CSSProperties["borderTopStyle"], borderTopColor: s.color, borderTopWidth: Math.max(1, Number(s.thickness) || 1), width: `${w}%`, margin }} />;
}

function ButtonBlock({ s }: { s: S }) {
  if (!s.label) return null;
  const external = /^https?:\/\//i.test(String(s.url));
  const cls = ({ primary: "bb-btn bb-btn-primary", dark: "bb-btn bb-btn-dark", outline: "bb-btn bb-btn-outline", link: "cr-textlink" } as Record<string, string>)[s.style] ?? "bb-btn bb-btn-outline";
  return (
    <p className="cr-actions">
      <a className={cls} href={s.url || "#"} target={s.new_tab || external ? "_blank" : undefined} rel={s.new_tab || external ? "noopener noreferrer" : undefined}>
        {s.label}
        {external ? <LIcon name="external" size={16} /> : null}
      </a>
    </p>
  );
}

function Embed({ s, ctx }: { s: S; ctx: BlockContext }) {
  const href = String(s.url ?? "");
  if (!href) return ctx.editing ? <Placeholder>Add the page address</Placeholder> : null;
  if (!embedAllowed(href)) return <Placeholder>This address cannot be embedded. See the allowed hosts in the block settings.</Placeholder>;
  const fixed = s.mode === "fixed";
  const host = href.startsWith("/") ? "this site" : new URL(href).hostname.replace(/^www\./, "");
  return (
    <div className="cr-embed" style={{ height: `${fixed ? Number(s.height) || 560 : 560}px` }}>
      {ctx.editing ? (
        <Placeholder>Interactive page · {host}</Placeholder>
      ) : (
        <iframe
          src={href}
          title={s.title || "Interactive page"}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-modals"
          allow="fullscreen; clipboard-write; autoplay; microphone; camera"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
      {s.open_link && !ctx.editing ? (
        <a className="cr-embed__open" href={href} target="_blank" rel="noopener noreferrer">
          Open in a new tab <LIcon name="external" size={14} />
        </a>
      ) : null}
    </div>
  );
}

function Accordion({ s }: { s: S }) {
  const items = (s.items as S[]) ?? [];
  if (!items.length) return null;
  return (
    <div className="cr-accordion">
      {s.title ? <h3 className="cr-accordion__title">{s.title}</h3> : null}
      {items.map((i, n) => (
        <details key={n} open={!!s.first_open && n === 0}>
          <summary>{i.title}</summary>
          <div className="cr-prose" dangerouslySetInnerHTML={MD(i.content)} />
        </details>
      ))}
    </div>
  );
}

function Resources({ s }: { s: S }) {
  const items = ((s.items as S[]) ?? []).filter((i) => i.label);
  if (!items.length) return null;
  return (
    <div className="cr-resources">
      <h3>{s.title || "Resources"}</h3>
      <ul>
        {items.map((i, n) => (
          <li key={n}>
            <a href={i.url || "#"} target="_blank" rel="noopener noreferrer">
              <LIcon name="download" size={18} />
              <span>
                <strong>{i.label}</strong>
                {i.note ? <small>{i.note}</small> : null}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Media                                                                      */
/* -------------------------------------------------------------------------- */

function withAutoplay(src: string): string {
  try {
    const u = new URL(src);
    u.searchParams.set("autoplay", u.hostname.includes("mediadelivery.net") ? "true" : "1");
    return u.toString();
  } catch {
    return src;
  }
}

function Video({ s, ctx }: { s: S; ctx: BlockContext }) {
  const [playing, setPlaying] = useState(false);
  const embed = typeof s._embed === "string" ? s._embed : "";
  const [w, h] = String(s.ratio).split(":").map(Number);
  const ratio = `${w || 16} / ${h || 9}`;
  const poster = s.poster as Img;
  if (!embed) {
    if (ctx.editing) return <Placeholder>{s._missing === "unplayable" ? "This video cannot be played. Check the link or the Bunny.net settings." : s._missing === "unsaved" ? "Save the lesson to see the video here." : "Paste a Bunny.net video ID, or a YouTube or Vimeo link"}</Placeholder>;
    return s.source ? <Placeholder>This video is not available right now.</Placeholder> : null;
  }
  return (
    <figure className="cr-video">
      <div className="cr-video__frame" style={{ aspectRatio: ratio }}>
        {playing && !ctx.editing ? (
          <iframe src={withAutoplay(embed)} title={s.title || "Video"} allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        ) : (
          <button type="button" className="cr-video__play" onClick={() => !ctx.editing && setPlaying(true)} aria-label={`Play video: ${s.title || "Video"}`}>
            {poster?.url ? <Pic img={poster} sizes="(min-width: 1100px) 760px, 100vw" /> : null}
            <span className="cr-video__icon">
              <LIcon name="play" size={30} />
            </span>
          </button>
        )}
      </div>
      {s.caption ? <figcaption>{s.caption}</figcaption> : null}
      {s.transcript ? (
        <details className="cr-transcript">
          <summary>Transcript</summary>
          <div className="cr-prose" dangerouslySetInnerHTML={MD(s.transcript)} />
        </details>
      ) : null}
    </figure>
  );
}

function Audio({ s, ctx }: { s: S; ctx: BlockContext }) {
  const a = s._audio as { kind: "file"; src: string } | { kind: "spotify"; embed: string } | null;
  if (!a) return ctx.editing ? <Placeholder>Add an MP3 file or a Spotify link</Placeholder> : null;
  return (
    <figure className="cr-audio">
      <div className="cr-audio__head">
        <span className="cr-card__icon">
          <LIcon name="play" size={18} />
        </span>
        <div>
          <strong>{s.title || "Listen"}</strong>
          {s.caption ? <small>{s.caption}</small> : null}
        </div>
      </div>
      {a.kind === "file" ? (
        <audio controls preload="none" src={a.src}>
          Your browser cannot play audio.
        </audio>
      ) : (
        <iframe src={a.embed} title={s.title || "Audio"} height="152" loading="lazy" allow="encrypted-media" />
      )}
      {s.transcript ? (
        <details className="cr-transcript">
          <summary>Transcript</summary>
          <div className="cr-prose" dangerouslySetInnerHTML={MD(s.transcript)} />
        </details>
      ) : null}
    </figure>
  );
}

/* -------------------------------------------------------------------------- */
/* Learning blocks: the student's state is saved                               */
/* -------------------------------------------------------------------------- */

/** Saves after a short pause, so typing and clicking do not send a request each time. */
function useDebouncedSave(blockId: number, ctx: BlockContext) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"" | "saving" | "saved" | "error">("");
  const run = useCallback(
    (data: S, delay = 600) => {
      if (ctx.editing || !ctx.signedIn) return;
      if (timer.current) clearTimeout(timer.current);
      setStatus("saving");
      timer.current = setTimeout(() => {
        ctx.save(blockId, data).then(
          () => setStatus("saved"),
          () => setStatus("error"),
        );
      }, delay);
    },
    [blockId, ctx],
  );
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return { status, run };
}

const SignInHint = ({ ctx }: { ctx: BlockContext }) => (!ctx.signedIn && !ctx.editing ? <p className="cr-hint">Sign in to save your progress here.</p> : null);

function Checklist({ id, s, ctx }: { id: number; s: S; ctx: BlockContext }) {
  const items = (s.items as string[]) ?? [];
  const [checked, setChecked] = useState<number[]>(() => ((ctx.state[id]?.checked as number[]) ?? []));
  const { status, run } = useDebouncedSave(id, ctx);
  if (!items.length) return null;
  const toggle = (i: number) => {
    const next = checked.includes(i) ? checked.filter((x) => x !== i) : [...checked, i];
    setChecked(next);
    run({ checked: next }, 250);
  };
  return (
    <div className="cr-checklist">
      <div className="cr-checklist__head">
        <h3>{s.title}</h3>
        <span className="cr-meta">
          {checked.filter((i) => i < items.length).length} of {items.length}
          {status === "saving" ? " · Saving" : status === "error" ? " · Not saved" : ""}
        </span>
      </div>
      <ul>
        {items.map((t, i) => (
          <li key={i}>
            <label>
              <input type="checkbox" checked={checked.includes(i)} onChange={() => toggle(i)} />
              <span>{t}</span>
            </label>
          </li>
        ))}
      </ul>
      <SignInHint ctx={ctx} />
    </div>
  );
}

function QuestionBox({ id, s, ctx }: { id: number; s: S; ctx: BlockContext }) {
  const [answer, setAnswer] = useState<string>(() => String(ctx.state[id]?.answer ?? ""));
  const { status, run } = useDebouncedSave(id, ctx);
  return (
    <div className="cr-question">
      <label htmlFor={`q-${id}`} className="cr-question__prompt">
        {s.prompt}
      </label>
      <textarea
        id={`q-${id}`}
        rows={4}
        value={answer}
        maxLength={5000}
        placeholder={s.placeholder}
        disabled={ctx.editing || !ctx.signedIn}
        onChange={(e) => {
          setAnswer(e.target.value);
          run({ answer: e.target.value }, 900);
        }}
      />
      <p className="cr-meta">
        {s.share ? "Your answer is sent to the instructor." : "Only you can see this answer."}
        {status === "saving" ? " Saving" : status === "saved" ? " Saved" : status === "error" ? " Not saved" : ""}
      </p>
      {s.model && answer.trim() ? (
        <details className="cr-transcript">
          <summary>Compare with a model answer</summary>
          <div className="cr-prose" dangerouslySetInnerHTML={MD(s.model)} />
        </details>
      ) : null}
      <SignInHint ctx={ctx} />
    </div>
  );
}

function Poll({ id, s, ctx }: { id: number; s: S; ctx: BlockContext }) {
  const options = ((s.options as string[]) ?? []).filter(Boolean).slice(0, 8);
  const multiple = !!s.multiple;
  const saved = (ctx.state[id]?.choice as number[] | undefined) ?? [];
  const [choice, setChoice] = useState<number[]>(saved);
  const [voted, setVoted] = useState(saved.length > 0);
  const [results, setResults] = useState<number[] | undefined>(ctx.results[id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (options.length < 2) return ctx.editing ? <Placeholder>Add at least two options to the poll</Placeholder> : null;

  const pick = (i: number) => setChoice((cur) => (multiple ? (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]) : [i]));
  const vote = async () => {
    if (!choice.length || ctx.editing || !ctx.signedIn) return;
    setBusy(true);
    setError("");
    try {
      const res = await ctx.save(id, { choice });
      setResults(res?.results);
      setVoted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your vote was not saved.");
    } finally {
      setBusy(false);
    }
  };

  const total = (results ?? []).reduce((a, b) => a + b, 0);
  return (
    <div className="cr-poll">
      <h3 className="cr-poll__q">{s.question}</h3>
      {voted && s.show_results && results ? (
        <>
          <ul className="cr-poll__results">
            {options.map((o, i) => {
              const n = results[i] ?? 0;
              const pct = total ? Math.round((n / total) * 100) : 0;
              return (
                <li key={i} className={choice.includes(i) ? "is-mine" : ""}>
                  <div className="cr-poll__label">
                    <span>{o}</span>
                    <strong>
                      {pct}% <small>({n})</small>
                    </strong>
                  </div>
                  <div className="cr-poll__track">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="cr-meta">
            {total} {total === 1 ? "vote" : "votes"} ·{" "}
            <button type="button" className="cr-link" onClick={() => setVoted(false)}>
              Change my vote
            </button>
          </p>
        </>
      ) : voted ? (
        <p className="cr-meta">
          Thank you, your vote is saved.{" "}
          <button type="button" className="cr-link" onClick={() => setVoted(false)}>
            Change my vote
          </button>
        </p>
      ) : (
        <>
          <fieldset className="cr-poll__options" disabled={ctx.editing || !ctx.signedIn}>
            <legend className="cr-sr">{s.question}</legend>
            {options.map((o, i) => (
              <label key={i} className={choice.includes(i) ? "is-on" : ""}>
                <input type={multiple ? "checkbox" : "radio"} name={`poll-${id}`} checked={choice.includes(i)} onChange={() => pick(i)} />
                <span>{o}</span>
              </label>
            ))}
          </fieldset>
          <button type="button" className="bb-btn bb-btn-dark cr-btn-sm" onClick={() => void vote()} disabled={busy || !choice.length || ctx.editing || !ctx.signedIn}>
            {busy ? "Saving" : "Vote"}
          </button>
          <p className="cr-meta">{multiple ? "Pick one or more. " : ""}Votes are anonymous.</p>
          {error ? (
            <p role="alert" className="cr-error">
              {error}
            </p>
          ) : null}
          <SignInHint ctx={ctx} />
        </>
      )}
    </div>
  );
}

function Flashcards({ id, s, ctx }: { id: number; s: S; ctx: BlockContext }) {
  const cards = (s.items as S[]) ?? [];
  const [known, setKnown] = useState<number[]>(() => ((ctx.state[id]?.known as number[]) ?? []));
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const { run } = useDebouncedSave(id, ctx);
  if (!cards.length) return null;
  const card = cards[Math.min(i, cards.length - 1)];
  const go = (d: number) => {
    setFlipped(false);
    setI((x) => (x + d + cards.length) % cards.length);
  };
  const mark = (yes: boolean) => {
    const next = yes ? [...new Set([...known, i])] : known.filter((x) => x !== i);
    setKnown(next);
    run({ known: next }, 300);
    go(1);
  };
  return (
    <div className="cr-flash">
      <div className="cr-flash__head">
        <h3>{s.title}</h3>
        <span className="cr-meta">
          {known.filter((k) => k < cards.length).length} of {cards.length} known
        </span>
      </div>
      <button type="button" className={`cr-flash__card${flipped ? " is-flipped" : ""}`} onClick={() => setFlipped((f) => !f)} aria-label={flipped ? "Show the front of the card" : "Show the back of the card"}>
        <span className="cr-flash__side">{flipped ? "Answer" : `Card ${i + 1} of ${cards.length}`}</span>
        <span className="cr-flash__text" aria-live="polite">
          {flipped ? card.back : card.front}
        </span>
        <span className="cr-flash__tap">{flipped ? "Click to flip back" : "Click to reveal the answer"}</span>
      </button>
      <div className="cr-flash__bar">
        <button type="button" className="bb-btn bb-btn-outline" onClick={() => go(-1)}>
          Previous
        </button>
        <button type="button" className="bb-btn bb-btn-outline" onClick={() => mark(false)}>
          Again
        </button>
        <button type="button" className="bb-btn bb-btn-dark" onClick={() => mark(true)}>
          I know it
        </button>
      </div>
      <SignInHint ctx={ctx} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Dispatcher                                                                 */
/* -------------------------------------------------------------------------- */

export const BlockView = memo(function BlockView({ block }: { block: PlayerBlock }) {
  const ctx = useContext(BlockCtx);
  const { id, type, settings: s } = block;
  let body: ReactNode = null;
  switch (type) {
    case "heading": body = <Heading s={s} />; break;
    case "text": body = <Text s={s} />; break;
    case "bullets": body = <Bullets s={s} />; break;
    case "quote": body = <Quote s={s} />; break;
    case "callout": body = <Callout s={s} />; break;
    case "image": body = <ImageBlock s={s} ctx={ctx} />; break;
    case "gallery": body = <Gallery s={s} ctx={ctx} />; break;
    case "video": body = <Video s={s} ctx={ctx} />; break;
    case "audio": body = <Audio s={s} ctx={ctx} />; break;
    case "steps": body = <Steps s={s} />; break;
    case "cards": body = <Cards s={s} />; break;
    case "compare": body = <Compare s={s} />; break;
    case "accordion": body = <Accordion s={s} />; break;
    case "code": body = <Code s={s} />; break;
    case "table": body = <Table s={s} />; break;
    case "resources": body = <Resources s={s} />; break;
    case "embed": body = <Embed s={s} ctx={ctx} />; break;
    case "button": body = <ButtonBlock s={s} />; break;
    case "checklist": body = <Checklist id={id} s={s} ctx={ctx} />; break;
    case "question": body = <QuestionBox id={id} s={s} ctx={ctx} />; break;
    case "poll": body = <Poll id={id} s={s} ctx={ctx} />; break;
    case "flashcards": body = <Flashcards id={id} s={s} ctx={ctx} />; break;
    case "divider": body = <Divider s={s} />; break;
    case "spacer": return <div style={{ height: Math.max(0, Number(s.height) || 0) }} aria-hidden="true" />;
  }
  return body ? <div className={`cr-block cr-block--${type}`}>{body}</div> : null;
});

export function BlockList({ blocks }: { blocks: PlayerBlock[] }) {
  return (
    <div className="cr-blocks">
      {blocks.map((b) => (
        <BlockView key={b.id} block={b} />
      ))}
    </div>
  );
}
