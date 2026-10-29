// Plain-text bodies with mention tokens. No HTML anywhere: the renderer turns segments into React elements.
//
// Stored token: @[Display Name](user:<uuid>)   The name inside is cosmetic; the id is what counts.

export const MENTION_RE = /@\[([^\]\n]{1,80})\]\(user:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;
const URL_RE = /https?:\/\/[^\s<>"'`]+/gi;

export type Segment = { kind: "text"; text: string } | { kind: "mention"; name: string; userId: string } | { kind: "link"; href: string; text: string };

export type MentionToken = { name: string; userId: string };

/** Mention tokens in order of appearance, de-duplicated by user id, at most `max`. */
export function parseMentions(body: string, max = 10): MentionToken[] {
  const seen = new Set<string>();
  const out: MentionToken[] = [];
  for (const m of body.matchAll(MENTION_RE)) {
    const userId = m[2].toLowerCase();
    if (seen.has(userId)) continue;
    seen.add(userId);
    out.push({ name: m[1], userId });
    if (out.length >= max) break;
  }
  return out;
}

/** Trailing punctuation that belongs to the sentence, not the address. */
function trimUrl(raw: string): { url: string; rest: string } {
  let url = raw;
  while (/[.,;:!?)\]}]$/.test(url)) {
    if (url.endsWith(")") && (url.match(/\(/g)?.length ?? 0) >= (url.match(/\)/g)?.length ?? 0)) break;
    url = url.slice(0, -1);
  }
  return { url, rest: raw.slice(url.length) };
}

function linkify(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    const { url, rest } = trimUrl(m[0]);
    if (start > last) out.push({ kind: "text", text: text.slice(last, start) });
    try {
      out.push({ kind: "link", href: new URL(url).toString(), text: url });
      if (rest) out.push({ kind: "text", text: rest });
    } catch {
      out.push({ kind: "text", text: m[0] });
    }
    last = start + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

/** Splits a body into text, mention and link segments. */
export function tokenize(body: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of body.matchAll(MENTION_RE)) {
    const start = m.index ?? 0;
    if (start > last) out.push(...linkify(body.slice(last, start)));
    out.push({ kind: "mention", name: m[1], userId: m[2].toLowerCase() });
    last = start + m[0].length;
  }
  if (last < body.length) out.push(...linkify(body.slice(last)));
  return out.reduce<Segment[]>((acc, s) => {
    const prev = acc[acc.length - 1];
    if (s.kind === "text" && prev?.kind === "text") prev.text += s.text;
    else acc.push(s);
    return acc;
  }, []);
}

/** The body with every token shown as @Name: previews, snippets, report snapshots. */
export function plainText(body: string): string {
  return body.replace(MENTION_RE, (_m, name: string) => `@${name}`);
}

export function snippet(body: string, max = 140): string {
  const t = plainText(body).replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Replaces tokens whose user id is not in `valid` with plain @Name text. */
export function neutralizeMentions(body: string, valid: ReadonlySet<string>): string {
  return body.replace(MENTION_RE, (_m, name: string, id: string) => (valid.has(id.toLowerCase()) ? `@[${name}](user:${id.toLowerCase()})` : `@${name}`));
}

/** Text normalisation for stored bodies: line breaks kept, control characters removed. */
export function cleanBody(v: unknown): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

// ---- editor side: the textarea shows @Name, the picked people are kept beside it ----

export type Pick = { name: string; userId: string };

/** Stored body to editor text plus the people it mentions. */
export function toEditable(body: string): { text: string; picks: Pick[] } {
  return { text: plainText(body), picks: parseMentions(body, 50).map((m) => ({ name: m.name, userId: m.userId })) };
}

/** Editor text to stored body: each picked person's first unclaimed @Name becomes a token. */
export function toStored(text: string, picks: Pick[]): string {
  const claimed: { start: number; end: number; pick: Pick }[] = [];
  const ordered = [...picks].sort((a, b) => b.name.length - a.name.length);
  for (const pick of ordered) {
    const needle = `@${pick.name}`;
    let from = 0;
    for (;;) {
      const i = text.indexOf(needle, from);
      if (i < 0) break;
      const end = i + needle.length;
      const next = text[end];
      const boundary = !next || !/[\p{L}\p{N}_]/u.test(next);
      if (boundary && !claimed.some((c) => i < c.end && end > c.start)) {
        claimed.push({ start: i, end, pick });
        break;
      }
      from = i + 1;
    }
  }
  claimed.sort((a, b) => a.start - b.start);
  let out = "";
  let last = 0;
  for (const c of claimed) {
    out += text.slice(last, c.start) + `@[${c.pick.name.replace(/[\]\n]/g, "")}](user:${c.pick.userId})`;
    last = c.end;
  }
  return out + text.slice(last);
}
