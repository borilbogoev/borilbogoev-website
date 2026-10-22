// Videos and audio in a lesson: what the author pasted, turned into something safe to embed.
// Bunny.net videos are protected with the library's embed token (a short-lived, signed address), so a copied link stops working.
import { createHash } from "node:crypto";
import { parseAudio, parseVideo } from "@/modules/landing/lib/media";

export type VideoProvider = "bunny" | "youtube" | "vimeo" | "file";
export type VideoRef = { provider: VideoProvider; id: string; libraryId?: string; src?: string };

const BUNNY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A Bunny.net video from a bare video ID (the library comes from the settings), or from an embed or play address
 * (https://iframe.mediadelivery.net/embed/<library>/<video>). YouTube, Vimeo and MP4 links are recognised too.
 */
export function parseVideoRef(input: string, defaultLibrary = ""): VideoRef | null {
  const v = input.trim();
  if (!v) return null;
  if (BUNNY_ID.test(v)) return defaultLibrary ? { provider: "bunny", id: v.toLowerCase(), libraryId: defaultLibrary } : null;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return null;
  }
  if (u.hostname === "iframe.mediadelivery.net" || u.hostname === "player.mediadelivery.net") {
    const m = /\/(?:embed|play)\/(\d+)\/([0-9a-f-]{36})/i.exec(u.pathname);
    return m ? { provider: "bunny", id: m[2].toLowerCase(), libraryId: m[1] } : null;
  }
  const other = parseVideo(v);
  if (!other || other.kind === "loom") return null;
  return { provider: other.kind, id: other.id, src: other.src };
}

/** Bunny's embed token: SHA-256 of the security key, the video ID and the expiry time. */
export function signBunny(ref: VideoRef, key: string, ttlHours: number): string {
  const expires = Math.floor(Date.now() / 1000) + Math.max(1, ttlHours) * 3600;
  const base = `https://iframe.mediadelivery.net/embed/${ref.libraryId}/${ref.id}`;
  const params = new URLSearchParams({ autoplay: "false", preload: "false", responsive: "true" });
  if (key) {
    params.set("token", createHash("sha256").update(`${key}${ref.id}${expires}`).digest("hex"));
    params.set("expires", String(expires));
  }
  return `${base}?${params}`;
}

/** The address a browser loads in the player frame. Null when the video cannot be played. */
export function embedSrc(ref: VideoRef, opts: { bunnyKey: string; ttlHours: number; start?: number }): string | null {
  const start = opts.start && opts.start > 0 ? Math.floor(opts.start) : 0;
  switch (ref.provider) {
    case "bunny":
      return signBunny(ref, opts.bunnyKey, opts.ttlHours) + (start ? `&t=${start}` : "");
    case "youtube":
      return `https://www.youtube-nocookie.com/embed/${ref.id}?rel=0&modestbranding=1${start ? `&start=${start}` : ""}`;
    case "vimeo":
      return `https://player.vimeo.com/video/${ref.id}?dnt=1${start ? `#t=${start}s` : ""}`;
    default:
      return null;
  }
}

export { parseAudio };
