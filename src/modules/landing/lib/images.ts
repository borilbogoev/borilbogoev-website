// Pictures for landing pages: stored in the private Blob store as a few WebP sizes, so the browser downloads only what fits its screen.
import sharp from "sharp";
import { MEDIA_ROUTE, putFile } from "@/modules/forms/lib/storage";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const WIDTHS = [480, 960, 1600];

export type StoredImage = { url: string; width: number; height: number; variants: { w: number; url: string }[] };

export async function storeImage(file: File): Promise<StoredImage> {
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "image";
  const input = Buffer.from(await file.arrayBuffer());

  // GIFs may be animated: keep them as they are.
  if (file.type === "image/gif") {
    const meta = await sharp(input).metadata();
    const saved = await putFile(`images/lp/${base}.gif`, input, "image/gif");
    return { url: `${MEDIA_ROUTE}${saved.pathname}`, width: meta.width ?? 0, height: meta.height ?? 0, variants: [] };
  }

  const oriented = sharp(input).rotate();
  const meta = await sharp(await oriented.clone().toBuffer()).metadata();
  const w0 = meta.width ?? 0;
  const h0 = meta.height ?? 0;
  if (!w0 || !h0) throw new Error("The file is not a readable image.");
  const widths = [...new Set(WIDTHS.map((w) => Math.min(w, w0)))].sort((a, b) => a - b);

  const variants: { w: number; url: string; h: number }[] = [];
  for (const w of widths) {
    const { data, info } = await oriented.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    const saved = await putFile(`images/lp/${base}-${w}.webp`, data, "image/webp");
    variants.push({ w: info.width, h: info.height, url: `${MEDIA_ROUTE}${saved.pathname}` });
  }
  const largest = variants[variants.length - 1];
  return { url: largest.url, width: largest.w, height: largest.h, variants: variants.map(({ w, url }) => ({ w, url })) };
}
