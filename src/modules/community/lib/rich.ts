// Rich posts: a post the SuperAdmin builds from the Landing Pages blocks. Pure helpers shared by the feed, the page and the admin.
import { parseVideo } from "@/modules/landing/lib/media";

export type RichBlock = { type: string; settings: Record<string, unknown> };

/** Looks of the feed snippet. Each is a combination of brand colours and a layout, drawn only from brand tokens. */
export const THEMES = ["ink", "paper", "signal", "tint", "frame"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_LABELS: Record<Theme, { name: string; desc: string }> = {
  ink: { name: "Ink", desc: "Dark band, red edge, picture on the right" },
  paper: { name: "Paper", desc: "White card, ink frame, picture on the left" },
  signal: { name: "Signal", desc: "Solid red, white type, framed picture" },
  tint: { name: "Tint", desc: "Soft red, wide picture on top" },
  frame: { name: "Frame", desc: "Light grey, ink border, large title" },
};
export const isTheme = (v: unknown): v is Theme => typeof v === "string" && (THEMES as readonly string[]).includes(v);

type Img = { url?: string; variants?: { w: number; url: string }[] };
/** The picture (and optional video link) chosen for the snippet. */
export type Featured = { image?: Img & { width?: number; height?: number }; video?: string };

/** What a block adds to the post, as a short label and an icon key. Only the blocks that are worth announcing in the feed. */
const HIGHLIGHT: Record<string, { label: string; icon: string }> = {
  form: { label: "Form", icon: "form" },
  countdown: { label: "Countdown", icon: "clock" },
  session: { label: "Live session", icon: "calendar" },
  video: { label: "Video", icon: "play" },
  audio: { label: "Audio", icon: "audio" },
  cta: { label: "Call to action", icon: "arrow" },
  buttons: { label: "Buttons", icon: "arrow" },
  pricing: { label: "Offer", icon: "tag" },
  bonuses: { label: "Bonuses", icon: "tag" },
  gallery: { label: "Gallery", icon: "image" },
  carousel: { label: "Gallery", icon: "image" },
  faq: { label: "FAQ", icon: "help" },
  steps: { label: "Steps", icon: "list" },
  testimonials: { label: "Testimonials", icon: "quote" },
  quote: { label: "Quote", icon: "quote" },
  embed: { label: "Booking", icon: "calendar" },
  compare: { label: "Comparison", icon: "list" },
  guarantee: { label: "Guarantee", icon: "shield" },
};

export type Highlight = { label: string; icon: string };

/** Up to six distinct highlights, in the order the blocks appear. */
export function highlightsOf(blocks: RichBlock[], max = 6): Highlight[] {
  const out: Highlight[] = [];
  for (const b of blocks) {
    const h = HIGHLIGHT[b.type];
    if (h && !out.some((o) => o.label === h.label)) out.push(h);
    if (out.length >= max) break;
  }
  return out;
}

const imgUrl = (i: unknown): string => {
  const x = i as Img | null | undefined;
  return x?.url ? (x.variants?.find((v) => v.w >= 600)?.url ?? x.variants?.[x.variants.length - 1]?.url ?? x.url) : "";
};

/** A picture for a video link: YouTube has one at a fixed address. Vimeo, Loom and files need a poster image. */
export function videoThumb(href: unknown): string {
  const v = typeof href === "string" && href ? parseVideo(href) : null;
  return v?.kind === "youtube" ? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` : "";
}

export type Cover = { url: string; video: boolean };

/**
 * The picture of the snippet, in this order: the featured image; the thumbnail of the featured video; then the first visual
 * block in the post (an image, hero image, gallery, cards... or a video with a cover image or a YouTube link).
 * `video` tells the feed to draw a play mark on it.
 */
export function snippetCover(blocks: RichBlock[], featured?: Featured | null): Cover {
  const fv = featured?.video ?? "";
  const fi = imgUrl(featured?.image);
  if (fi) return { url: fi, video: !!fv };
  if (fv) {
    const t = videoThumb(fv);
    if (t) return { url: t, video: true };
  }
  for (const b of blocks) {
    const s = b.settings ?? {};
    if (b.type === "video") {
      const u = imgUrl(s.poster) || videoThumb(s.url);
      if (u) return { url: u, video: true };
      continue;
    }
    for (const k of ["image", "poster", "artwork", "photo"]) {
      const u = imgUrl(s[k]);
      if (u) return { url: u, video: false };
    }
    if (Array.isArray(s.items)) for (const it of s.items as Record<string, unknown>[]) {
      const u = imgUrl(it?.image);
      if (u) return { url: u, video: false };
    }
  }
  return { url: "", video: false };
}

/** Kept for lists that only need the address. */
export const coverOf = (blocks: RichBlock[], featured?: Featured | null): string => snippetCover(blocks, featured).url;
