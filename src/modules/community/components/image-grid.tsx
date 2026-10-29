"use client";

import { useEffect, useRef, useState } from "react";
import type { Media } from "../lib/client";
import { t } from "../strings";

export function ImageGrid({ media }: { media: Media[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!media.length) return null;
  return (
    <>
      <div className={`cm-grid cm-grid--${Math.min(media.length, 4)}`}>
        {media.map((m, i) => (
          <button key={m.id} type="button" className="cm-grid__item" onClick={() => setOpen(i)} aria-label={m.alt ? `${t.a11y.image}: ${m.alt}` : `${t.a11y.image} ${i + 1} of ${media.length}`}>
            <img src={m.url} alt={m.alt} width={m.width || undefined} height={m.height || undefined} loading="lazy" decoding="async" />
          </button>
        ))}
      </div>
      {open !== null ? <ImageLightbox media={media} index={open} onIndex={setOpen} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

/** A simple full-window viewer. Escape closes, arrow keys move, focus returns to the thumbnail. */
export function ImageLightbox({ media, index, onIndex, onClose }: { media: Media[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const m = media[index];

  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="cm-lightbox"
      aria-label={t.a11y.lightbox}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" && index < media.length - 1) onIndex(index + 1);
        if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      }}
    >
      <button type="button" className="cm-lightbox__close bb-btn bb-btn-outline" onClick={onClose} autoFocus>
        {t.action.close}
      </button>
      <img src={m.url} alt={m.alt} />
      {media.length > 1 ? (
        <div className="cm-lightbox__nav">
          <button type="button" className="bb-btn bb-btn-outline" disabled={index === 0} onClick={() => onIndex(index - 1)} aria-label={t.a11y.prev}>
            ←
          </button>
          <span aria-live="polite">
            {index + 1} / {media.length}
          </span>
          <button type="button" className="bb-btn bb-btn-outline" disabled={index === media.length - 1} onClick={() => onIndex(index + 1)} aria-label={t.a11y.next}>
            →
          </button>
        </div>
      ) : null}
    </dialog>
  );
}
