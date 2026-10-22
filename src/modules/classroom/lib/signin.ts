// Student sign-in without a password: a link sent by email, valid for 20 minutes. It proves the address is the student's,
// so it doubles as account creation (when sign-up is open) and as "forgot password". Students are ordinary users with the
// role "student"; the session is the same cookie as the admin's.
import { SignJWT, jwtVerify } from "jose";
import { site } from "@/content/site";
import { getBaseUrl } from "@/modules/auth/google";
import { safeNext } from "@/modules/auth/redirect";
import { createUser, getUserByEmail, normalizeEmail } from "@/modules/auth/users";
import { sendMail } from "@/modules/forms/lib/notify";
import { escapeHtml } from "@/modules/forms/lib/markdown";
import { getGlobalSettings } from "@/modules/forms/lib/settings-store";
import { cleanEmail, cleanText } from "@/modules/forms/lib/sanitize";
import { getSettings } from "./settings-store";

const PURPOSE = "classroom-signin";
const TTL_MIN = 20;
export const STUDENT_HOME = "/classroom/my";

export const studentNext = (next: string | null | undefined) => safeNext(next, STUDENT_HOME);

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET is missing or shorter than 32 characters.");
  return new TextEncoder().encode(s);
}

async function makeToken(email: string, name: string, next: string) {
  return new SignJWT({ purpose: PURPOSE, name, next })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(`${TTL_MIN}m`)
    .sign(secret());
}

export async function readToken(token: string | null): Promise<{ email: string; name: string; next: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.purpose !== PURPOSE || !payload.sub) return null;
    return { email: payload.sub, name: String(payload.name ?? ""), next: studentNext(String(payload.next ?? "")) };
  } catch {
    return null;
  }
}

/* A small brake: 5 links per address and hour, 20 per network address and hour. It lives in one server instance. */
const sent = new Map<string, number[]>();
function tooMany(key: string, max: number): boolean {
  const now = Date.now();
  const list = (sent.get(key) ?? []).filter((t) => now - t < 3_600_000);
  if (list.length >= max) return true;
  list.push(now);
  sent.set(key, list);
  if (sent.size > 4000) for (const [k, v] of sent) if (!v.some((t) => now - t < 3_600_000)) sent.delete(k);
  return false;
}

export type LinkResult = { ok: true } | { ok: false; error: string; status: number };

/**
 * Sends the sign-in link. The answer is the same whether or not the address has an account, so the form cannot be used to
 * find out who is registered. A person with no account gets one when they open the link, if sign-up is open.
 */
export async function sendSignInLink(input: { email: unknown; name?: unknown; next?: unknown; origin: string; ip: string }): Promise<LinkResult> {
  const email = normalizeEmail(cleanEmail(input.email));
  if (!email) return { ok: false, error: "Enter a valid email address.", status: 400 };
  if (tooMany(`e:${email}`, 5) || tooMany(`i:${input.ip}`, 20)) return { ok: false, error: "Too many links requested. Try again in an hour.", status: 429 };

  const [settings, user] = await Promise.all([getSettings(), getUserByEmail(email)]);
  // Emailed links are for students only: staff and admin accounts sign in with a password or Google, so a mailbox alone never opens the admin.
  const allowed = user ? user.status === "active" && user.role === "student" : settings.signup_open === 1;
  if (!allowed) return { ok: true };

  const name = cleanText(input.name, 120);
  const token = await makeToken(email, name || user?.name || "", studentNext(String(input.next ?? "")));
  const link = `${getBaseUrl(input.origin)}/api/classroom/auth/verify?token=${encodeURIComponent(token)}`;
  const g = await getGlobalSettings();
  const sentOk = await sendMail(
    {
      to: [email],
      subject: `Your sign-in link for the ${site.name} Classroom`,
      html: `<p>Hello${name || user?.name ? ` ${escapeHtml(name || user?.name || "")}` : ""},</p><p>Open this link to sign in to the Classroom. It works for ${TTL_MIN} minutes.</p><p><a href="${link}">Sign in to the Classroom</a></p><p>If you did not ask for it, ignore this email. Nobody can sign in without it.</p>`,
    },
    g,
  );
  if (!sentOk && process.env.NODE_ENV !== "production") console.warn("[classroom] sign-in link (email not sent):", link);
  return { ok: true };
}

export type VerifyResult = { ok: true; userId: string; version: number; next: string } | { ok: false; reason: "invalid" | "closed" | "disabled" };

/** Opens the link: signs an existing user in, or creates the student account when sign-up is open. */
export async function verifySignInLink(token: string | null): Promise<VerifyResult> {
  const claims = await readToken(token);
  if (!claims) return { ok: false, reason: "invalid" };
  let user = await getUserByEmail(claims.email);
  if (!user) {
    if ((await getSettings()).signup_open !== 1) return { ok: false, reason: "closed" };
    user = await createUser({ email: claims.email, name: claims.name, role: "student", password: null });
  }
  if (user.role !== "student") return { ok: false, reason: "invalid" };
  if (user.status !== "active") return { ok: false, reason: "disabled" };
  return { ok: true, userId: user.id, version: user.sessionVersion, next: claims.next };
}
