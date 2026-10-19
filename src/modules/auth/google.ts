import { Google } from "arctic";

export const OAUTH_STATE_COOKIE = "bb_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "bb_oauth_verifier";
export const OAUTH_NEXT_COOKIE = "bb_oauth_next";

export const isGoogleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

/** Base URL for the OAuth redirect. Set AUTH_URL to pin it to your production domain. */
export function getBaseUrl(requestOrigin: string) {
  return (process.env.AUTH_URL ?? requestOrigin).replace(/\/$/, "");
}

export function getGoogleClient(requestOrigin: string) {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Google sign-in is not configured.");
  return new Google(id, secret, `${getBaseUrl(requestOrigin)}/api/admin/auth/google/callback`);
}

export const oauthCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 10, // 10 minutes
};
