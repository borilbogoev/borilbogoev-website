// The portrait in the header, a 34px circle that stands in for the About link. Pre-compressed (see scripts/optimize-images.mjs).
export function PortraitMark({ size = 34, active = false }: { size?: number; active?: boolean }) {
  return (
    <img
      src="/brand/portrait-nav-68.webp"
      srcSet="/brand/portrait-nav-34.webp 34w, /brand/portrait-nav-68.webp 68w, /brand/portrait-nav-102.webp 102w"
      sizes={`${size}px`}
      width={size}
      height={size}
      alt=""
      decoding="async"
      className={`block rounded-full border bg-surface ${active ? "border-brand" : "border-line"}`}
    />
  );
}
