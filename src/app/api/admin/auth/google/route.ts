import { NextResponse, type NextRequest } from "next/server";
import { generateCodeVerifier, generateState } from "arctic";
import { getGoogleClient, isGoogleConfigured, OAUTH_NEXT_COOKIE, OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE, oauthCookieOptions } from "@/modules/auth/google";
import { safeNext } from "@/modules/auth/redirect";

// Step 1: send the user to Google.
export async function GET(request: NextRequest) {
  if (!isGoogleConfigured()) return NextResponse.redirect(new URL("/admin/login?error=google_not_configured", request.url));

  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = getGoogleClient(request.nextUrl.origin).createAuthorizationURL(state, verifier, ["openid", "email", "profile"]);
  url.searchParams.set("prompt", "select_account");

  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_STATE_COOKIE, state, oauthCookieOptions);
  res.cookies.set(OAUTH_VERIFIER_COOKIE, verifier, oauthCookieOptions);
  res.cookies.set(OAUTH_NEXT_COOKIE, safeNext(request.nextUrl.searchParams.get("next")), oauthCookieOptions);
  return res;
}
