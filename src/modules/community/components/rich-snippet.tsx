import Link from "next/link";
import type { ReactNode } from "react";
import type { Highlight, Theme } from "../lib/rich";
import { t } from "../strings";
import { HighlightIcon } from "./highlight-icon";

export type SnippetData = {
  title: string;
  excerpt: string;
  theme: Theme;
  cover: string;
  coverVideo: boolean;
  highlights: Highlight[];
  pinned: boolean;
  categoryName?: string;
  commentCount: number;
  commentsLocked: boolean;
  hidden?: boolean;
};

/**
 * A rich post as it appears in the feed. Pure markup: the colours and the layout come from the theme class (`cm-rich--<theme>`),
 * which uses brand tokens only. The feed fills the slots (menu, like button, time); the builder shows it as a live preview.
 */
export function RichSnippet({ data, href, menu, like, time, id }: { data: SnippetData; href: string; menu?: ReactNode; like?: ReactNode; time?: ReactNode; id?: string }) {
  return (
    <article className={`cm-rich cm-rich--${data.theme}${data.cover ? " has-cover" : ""}${data.hidden ? " is-hidden" : ""}`} id={id}>
      <div className="cm-rich__main">
        <div className="cm-rich__top">
          <span className="cm-rich__tag">
            {data.pinned ? (
              <>
                <HighlightIcon name="pin" size={14} /> {t.rich.pinned}
              </>
            ) : (
              t.rich.featured
            )}
            {data.categoryName ? <span className="cm-rich__cat"> · {data.categoryName}</span> : null}
          </span>
          {menu}
        </div>
        <h2 className="cm-rich__title">
          <Link href={href} className="cm-rich__link">
            {data.title}
          </Link>
          {data.theme === "frame" && !data.title.endsWith(".") ? <span className="cm-rich__dot">.</span> : null}
        </h2>
        {data.excerpt ? <p className="cm-rich__excerpt">{data.excerpt}</p> : null}
        {data.highlights.length ? (
          <ul className="cm-rich__chips" aria-label="What is inside">
            {data.highlights.map((h) => (
              <li key={h.label}>
                <HighlightIcon name={h.icon} size={14} /> {h.label}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="cm-rich__foot">
          {like}
          <Link href={href} className="cm-rich__comments">
            {t.post.comments(data.commentCount)}
            {data.commentsLocked ? " · off" : ""}
          </Link>
          {time}
        </div>
      </div>
      {data.cover ? (
        <Link href={href} className="cm-rich__cover" tabIndex={-1} aria-hidden="true">
          <img src={data.cover} alt="" loading="lazy" decoding="async" className={data.cover.includes("ytimg.com/vi/") ? "is-yt" : undefined} />
          {data.coverVideo ? (
            <span className="cm-rich__play">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </span>
          ) : null}
        </Link>
      ) : null}
    </article>
  );
}
