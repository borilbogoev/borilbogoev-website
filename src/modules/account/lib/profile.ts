// The signed-in person's own profile: what My Info reads and writes. Roles, status and email are never changed here.
import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { db } from "@/db/use";
import { cleanMultiline, cleanText } from "@/modules/forms/lib/sanitize";
import type { User } from "@/modules/auth/schema";

const { users } = schema;

export type Profile = {
  id: string;
  email: string;
  name: string;
  username: string;
  avatarUrl: string;
  phone: string;
  company: string;
  jobTitle: string;
  country: string;
  timezone: string;
  bio: string;
  role: string;
  hasPassword: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
};

export const toProfile = (u: User): Profile => ({
  id: u.id,
  email: u.email,
  name: u.name,
  username: u.username ?? "",
  avatarUrl: u.avatarUrl ?? "",
  phone: u.phone ?? "",
  company: u.company ?? "",
  jobTitle: u.jobTitle ?? "",
  country: u.country ?? "",
  timezone: u.timezone ?? "",
  bio: u.bio ?? "",
  role: u.role,
  hasPassword: !!u.passwordHash,
  createdAt: u.createdAt,
  lastLoginAt: u.lastLoginAt,
});

export async function getProfile(id: string): Promise<Profile | null> {
  const [u] = await db().select().from(users).where(eq(users.id, id)).limit(1);
  return u ? toProfile(u) : null;
}

export const USERNAME_RULE = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/** The profile as far as it is filled in, for the progress hint on the home page. */
export function profileCompleteness(p: Profile): { done: number; total: number; missing: string[] } {
  const checks: [string, boolean][] = [
    ["name", !!p.name],
    ["username", !!p.username],
    ["photo", !!p.avatarUrl],
    ["phone", !!p.phone],
    ["company", !!p.company],
    ["job title", !!p.jobTitle],
    ["country", !!p.country],
  ];
  return { done: checks.filter(([, ok]) => ok).length, total: checks.length, missing: checks.filter(([, ok]) => !ok).map(([n]) => n) };
}

export type ProfileInput = Partial<Record<"name" | "username" | "phone" | "company" | "jobTitle" | "country" | "timezone" | "bio", unknown>>;

export async function saveProfile(id: string, input: ProfileInput): Promise<{ ok: true } | { ok: false; error: string; field?: string }> {
  const name = cleanText(input.name, 120);
  if (!name) return { ok: false, error: "Enter your name.", field: "name" };
  const username = cleanText(input.username, 40).toLowerCase();
  if (username && !USERNAME_RULE.test(username)) return { ok: false, error: "A username is 3 to 30 characters: letters, numbers, dots, dashes and underscores.", field: "username" };
  try {
    await db()
      .update(users)
      .set({
        name,
        username: username || null,
        phone: cleanText(input.phone, 40) || null,
        company: cleanText(input.company, 120) || null,
        jobTitle: cleanText(input.jobTitle, 120) || null,
        country: cleanText(input.country, 80) || null,
        timezone: cleanText(input.timezone, 60) || null,
        bio: cleanMultiline(input.bio).slice(0, 600) || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  } catch (error) {
    if (/users_username_idx|duplicate key/i.test(String((error as { message?: string })?.message) + String((error as { cause?: { message?: string } })?.cause?.message))) return { ok: false, error: "That username is taken. Try another.", field: "username" };
    throw error;
  }
  return { ok: true };
}

export async function setAvatar(id: string, url: string | null): Promise<void> {
  await db().update(users).set({ avatarUrl: url, updatedAt: new Date() }).where(eq(users.id, id));
}

/** A username for a new account: the part of the email before the @, made safe and unique. */
export function usernameFrom(email: string, taken: Set<string>): string {
  let base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]+/g, "").replace(/^[^a-z0-9]+/, "").slice(0, 24);
  if (base.length < 3) base = `${base}user`.slice(0, 24);
  let candidate = base;
  for (let i = 2; taken.has(candidate); i++) candidate = `${base}${i}`.slice(0, 30);
  taken.add(candidate);
  return candidate;
}
