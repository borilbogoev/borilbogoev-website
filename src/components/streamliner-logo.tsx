import { site } from "@/content/site";

// The Streamliner logo, trimmed and pre-compressed (see scripts/optimize-images.mjs). Ratio 7.29 : 1.
export function StreamlinerLogo({ height = 22, className = "" }: { height?: number; className?: string }) {
  const width = Math.round(height * 7.29);
  return (
    <img
      src="/brand/streamliner-72.webp"
      srcSet="/brand/streamliner-36.webp 262w, /brand/streamliner-72.webp 525w, /brand/streamliner-108.webp 787w"
      sizes={`${width}px`}
      width={width}
      height={height}
      alt={`The Streamliner by ${site.name}`}
      decoding="async"
      className={className}
    />
  );
}
