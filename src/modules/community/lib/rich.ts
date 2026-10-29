// Rich posts: a post the SuperAdmin builds from the Landing Pages blocks. Pure helpers shared by the feed, the page and the admin.

export type RichBlock = { type: string; settings: Record<string, unknown> };

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

type Img = { url?: string; variants?: { w: number; url: string }[] };
const imgUrl = (i: unknown): string => {
  const x = i as Img | null | undefined;
  return x?.url ? (x.variants?.find((v) => v.w >= 400)?.url ?? x.variants?.[0]?.url ?? x.url) : "";
};

/** The first picture found in the blocks: hero image, image block, gallery, cards. Used as the cover in lists. */
export function coverOf(blocks: RichBlock[]): string {
  for (const b of blocks) {
    const s = b.settings ?? {};
    for (const k of ["image", "poster", "artwork", "photo"]) {
      const u = imgUrl(s[k]);
      if (u) return u;
    }
    if (Array.isArray(s.items)) for (const it of s.items as Record<string, unknown>[]) {
      const u = imgUrl(it?.image);
      if (u) return u;
    }
  }
  return "";
}
