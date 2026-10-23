import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "bb_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14; // 14 days

export type SessionClaims = {
  userId: string;
  version: number; // must match users.session_version, so a password change or a disabled account ends old sessions
  method: "password" | "google" | "link"; // link: emailed School sign-in link
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET is missing or shorter than 32 characters.");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(claims: SessionClaims) {
  return new SignJWT({ ver: claims.version, method: claims.method })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

/** Checks the signature and expiry only. The database check happens in getCurrentUser(). */
export async function verifySessionToken(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.ver !== "number") return null;
    return { userId: payload.sub, version: payload.ver, method: payload.method === "google" ? "google" : payload.method === "link" ? "link" : "password" };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
