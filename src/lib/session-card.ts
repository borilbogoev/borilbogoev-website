// The Session block: a dark announcement card for a dated live event (a Session, webinar or workshop).
// One definition, used by Forms, Landing Pages, Presentations and School. The controls live in
// modules/forms/lib/blocks.ts (block type "session"); this file turns the saved settings into what the card shows.

export type SessionData = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  text?: string;
  bullets?: { text?: string }[] | string[];
  /** Event date as YYYY-MM-DD. */
  date?: string;
  /** Event start, 24-hour HH:MM. */
  time?: string;
  /** UTC offset of the start time, e.g. +04:00. */
  offset?: string;
  /** Time zone as shown on the card, e.g. Gulf Standard Time (Dubai). */
  zone?: string;
  button_label?: string;
  button_url?: string;
  secondary_label?: string;
  secondary_url?: string;
  image?: { url?: string; width?: number; height?: number } | null;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type SessionWhen = { iso: string; day: string; weekday: string; month: string; year: string; clock: string } | null;

/** Day, weekday, month, year and 12-hour clock from the plain fields, so nobody types them twice. Null when the date is not set. */
export function sessionWhen(d: Pick<SessionData, "date" | "time" | "offset">): SessionWhen {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((d.date ?? "").trim());
  if (!m) return null;
  const [y, mo, da] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, da));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== da) return null;
  const t = /^(\d{1,2}):(\d{2})$/.exec((d.time ?? "").trim());
  const hh = t ? Math.min(23, Number(t[1])) : 0;
  const mm = t ? Math.min(59, Number(t[2])) : 0;
  const offset = /^[+-]\d{2}:\d{2}$/.test((d.offset ?? "").trim()) ? (d.offset as string).trim() : "+00:00";
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    iso: `${m[1]}-${m[2]}-${m[3]}T${pad(hh)}:${pad(mm)}:00${offset}`,
    day: String(da),
    weekday: WEEKDAYS[probe.getUTCDay()],
    month: MONTHS[mo - 1],
    year: String(y),
    clock: t ? `${hh % 12 === 0 ? 12 : hh % 12}:${pad(mm)} ${hh < 12 ? "AM" : "PM"}` : "",
  };
}

export const bulletText = (b: { text?: string } | string): string => (typeof b === "string" ? b : String(b?.text ?? "")).trim();
