// Classroom settings: defaults and sanitizing. Pure, shared by the server and the admin UI.
// Secrets (the Bunny.net token key) are never part of this object: it only says whether one is saved.
import { cleanMultiline, cleanText, cleanEmail, toBool } from "@/modules/forms/lib/sanitize";

export type ClassroomSettings = {
  /** Anyone may create a student account at /classroom/sign-in. Off: only students added by an admin can sign in. */
  signup_open: number;
  /** Currency of the paid courses, such as AED. */
  currency: string;
  /** Who is told by email when a student asks to pay by bank transfer. Empty: the site's inquiry address. */
  notify_to: string;
  /** Bank transfer details, shown to a student who enrols in a paid course. */
  bank_beneficiary: string;
  bank_name: string;
  bank_iban: string;
  bank_swift: string;
  bank_instructions: string; // Markdown
  /** Bunny Stream. The library ID is public (it is in every embed address). The token key is secret and stored encrypted. */
  bunny_library_id: string;
  bunny_token_hours: number;
  /** Intro of /classroom. */
  hub_eyebrow: string;
  hub_title: string;
  hub_intro: string;
};

export const CURRENCIES = ["AED", "USD", "EUR", "GBP", "BGN"] as const;

export function settingsDefaults(): ClassroomSettings {
  return {
    signup_open: 1,
    currency: "AED",
    notify_to: "",
    bank_beneficiary: "",
    bank_name: "",
    bank_iban: "",
    bank_swift: "",
    bank_instructions: "Use your payment reference in the transfer description. Your access opens when the transfer is confirmed, usually within one working day.",
    bunny_library_id: "",
    bunny_token_hours: 6,
    hub_eyebrow: "Classroom",
    hub_title: "Learn the system.",
    hub_intro: "Courses, modules and lessons on AI, automation and the way I run my own operating system.",
  };
}

export function sanitizeSettings(input: unknown, base: ClassroomSettings = settingsDefaults()): ClassroomSettings {
  const d = settingsDefaults();
  const s = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const has = (k: keyof ClassroomSettings) => k in s;
  const out = { ...base };
  if (has("signup_open")) out.signup_open = toBool(s.signup_open) ? 1 : 0;
  if (has("currency")) out.currency = (CURRENCIES as readonly string[]).includes(String(s.currency)) ? String(s.currency) : d.currency;
  if (has("notify_to")) out.notify_to = cleanEmail(s.notify_to);
  for (const k of ["bank_beneficiary", "bank_name", "bank_swift"] as const) if (has(k)) out[k] = cleanText(s[k], 120);
  if (has("bank_iban")) out.bank_iban = cleanText(s.bank_iban, 60).toUpperCase();
  if (has("bank_instructions")) out.bank_instructions = cleanMultiline(s.bank_instructions, 1500);
  if (has("bunny_library_id")) out.bunny_library_id = cleanText(s.bunny_library_id, 20).replace(/\D/g, "");
  if (has("bunny_token_hours")) out.bunny_token_hours = Math.min(48, Math.max(1, Math.trunc(Number(s.bunny_token_hours)) || d.bunny_token_hours));
  for (const k of ["hub_eyebrow", "hub_title"] as const) if (has(k)) out[k] = cleanText(s[k], 80) || d[k];
  if (has("hub_intro")) out.hub_intro = cleanText(s.hub_intro, 300);
  return out;
}

export const bankConfigured = (g: ClassroomSettings) => Boolean(g.bank_iban || g.bank_name || g.bank_beneficiary);
