// Password protection of a deck. The password is stored as a scrypt hash. A viewer who knows it gets a token (an HMAC of
// the deck and its hash, so changing the password signs everyone out) that the browser keeps for the tab.
import { createHmac, timingSafeEqual } from "node:crypto";
import { hashPassword, verifyPassword } from "@/modules/auth/password";

export const MIN_DECK_PASSWORD = 4;

export const hashDeckPassword = hashPassword;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET is missing or shorter than 32 characters.");
  return s;
}

export function unlockToken(deckId: number, passwordHash: string): string {
  return createHmac("sha256", secret()).update(`deck:${deckId}:${passwordHash}`).digest("hex");
}

export function tokenValid(token: unknown, deckId: number, passwordHash: string): boolean {
  if (typeof token !== "string" || token.length !== 64) return false;
  const expected = Buffer.from(unlockToken(deckId, passwordHash));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function passwordValid(password: unknown, passwordHash: string): Promise<boolean> {
  return typeof password === "string" && password.length > 0 && password.length < 200 && (await verifyPassword(password, passwordHash));
}

/* A small brake on guessing: 8 wrong passwords per deck and visitor in 10 minutes. It lives in the memory of one server
   instance, so it slows guessing down but is not a hard limit. Pick a long password for anything that matters. */
const fails = new Map<string, { n: number; until: number }>();
const WINDOW = 10 * 60_000;
const MAX_FAILS = 8;

export function tooManyTries(key: string): boolean {
  const f = fails.get(key);
  if (!f) return false;
  if (f.until < Date.now()) {
    fails.delete(key);
    return false;
  }
  return f.n >= MAX_FAILS;
}

export function noteFail(key: string) {
  const f = fails.get(key);
  if (!f || f.until < Date.now()) fails.set(key, { n: 1, until: Date.now() + WINDOW });
  else f.n += 1;
  if (fails.size > 2000) for (const [k, v] of fails) if (v.until < Date.now()) fails.delete(k);
}
