import { NextResponse, type NextRequest } from "next/server";
import { decodeIdToken } from "arctic";
import { getGoogleClient, OAUTH_KIND_COOKIE, OAUTH_NEXT_COOKIE, OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE } from "@/modules/auth/google";
import { safeNext } from "@/modules/auth/redirect";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/modules/auth/session";
import { authenticateGoogle, createUser } from "@/modules/auth/users";
import { getSettings } from "@/modules/school/lib/settings-store";

type GoogleClaims = { email?: string; email_verified?: boolean; name?: string };

// Step 2: Google sends the user back here.
export async function GET(request: NextRequest) {
  // A sign-in that started in the School comes back to the School.
  const student = request.cookies.get(OAUTH_KIND_COOKIE)?.value === "student";
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(student ? `/school/sign-in?error=${code}` : `/admin/login?error=${code}`, request.url));
    clearOauthCookies(res);
    return res;
  };

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const verifier = request.cookies.get(OAUTH_VERIFIER_COOKIE)?.value;
  if (!code || !state || !storedState || !verifier || state !== storedState) return fail("google_failed");

  let claims: GoogleClaims;
  try {
    const tokens = await getGoogleClient(request.nextUrl.origin).validateAuthorizationCode(code, verifier);
    claims = decodeIdToken(tokens.idToken()) as GoogleClaims;
  } catch {
    return fail("google_failed");
  }

  const email = claims.email?.toLowerCase();
  if (!email || claims.email_verified !== true) return fail("google_failed");
  // Admin sign-in has no sign-up: only accounts created in Admin > Users get in. A School sign-in may create a student
  // account (role "student", no admin access) when sign-up is open; Google has verified the address.
  let result = await authenticateGoogle(email);
  if (!result.ok && student && result.reason === "invalid") {
    try {
      if ((await getSettings()).signup_open === 1) {
        await createUser({ email, name: String(claims.name ?? "").slice(0, 120), role: "student", password: null });
        result = await authenticateGoogle(email);
      }
    } catch {
      return fail("failed");
    }
  }
  if (!result.ok) return fail("not_allowed");

  const next = safeNext(request.cookies.get(OAUTH_NEXT_COOKIE)?.value, student ? "/school/my" : "/admin");
  const res = NextResponse.redirect(new URL(next, request.url));
  res.cookies.set(SESSION_COOKIE, await createSessionToken({ userId: result.user.id, version: result.user.sessionVersion, method: "google" }), sessionCookieOptions);
  clearOauthCookies(res);
  return res;
}

function clearOauthCookies(res: NextResponse) {
  res.cookies.delete(OAUTH_STATE_COOKIE);
  res.cookies.delete(OAUTH_VERIFIER_COOKIE);
  res.cookies.delete(OAUTH_NEXT_COOKIE);
  res.cookies.delete(OAUTH_KIND_COOKIE);
}
