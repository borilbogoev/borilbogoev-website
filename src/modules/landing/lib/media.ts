// Recognising video and audio links, and building responsive picture attributes.

export type VideoSource = { kind: "youtube" | "vimeo" | "loom" | "file"; id: string; src: string };

/** YouTube, Vimeo, Loom or a direct video file. Anything else is not played (null). */
export function parseVideo(href: string): VideoSource | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return /^[\w-]{6,20}$/.test(id) ? { kind: "youtube", id, src: href } : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const id = u.searchParams.get("v") ?? /^\/(?:embed|shorts|live)\/([\w-]{6,20})/.exec(u.pathname)?.[1] ?? "";
    return /^[\w-]{6,20}$/.test(id) ? { kind: "youtube", id, src: href } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = /(\d{5,12})/.exec(u.pathname)?.[1] ?? "";
    return id ? { kind: "vimeo", id, src: href } : null;
  }
  if (host === "loom.com") {
    const id = /\/(?:share|embed)\/([a-f0-9]{16,40})/i.exec(u.pathname)?.[1] ?? "";
    return id ? { kind: "loom", id, src: href } : null;
  }
  if (/\.(mp4|webm|mov)$/i.test(u.pathname)) return { kind: "file", id: "", src: href };
  return null;
}

export type AudioSource = { kind: "file"; src: string } | { kind: "spotify"; embed: string };

export function parseAudio(href: string): AudioSource | null {
  let u: URL;
  try {
    u = new URL(href, "https://borilbogoev.com");
  } catch {
    return null;
  }
  if (u.hostname === "open.spotify.com") {
    const m = /^\/(?:intl-[a-z]+\/)?(episode|show|track|playlist|album)\/([A-Za-z0-9]+)/.exec(u.pathname);
    return m ? { kind: "spotify", embed: `https://open.spotify.com/embed/${m[1]}/${m[2]}` } : null;
  }
  if (/\.(mp3|m4a|aac|ogg|wav)$/i.test(u.pathname)) return { kind: "file", src: href };
  return null;
}

/** "16:9" as a padding-top percentage. */
export function ratioPadding(ratio: string): string {
  const [w, h] = ratio.split(":").map(Number);
  return w > 0 && h > 0 ? `${((h / w) * 100).toFixed(3)}%` : "56.25%";
}
