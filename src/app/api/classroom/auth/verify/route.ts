import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { db } from "@/db/use";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/modules/auth/session";
import { verifySignInLink } from "@/modules/classroom/lib/signin";

export const runtime = "nodejs";

// The link in the sign-in email lands here: sign the student in and send them on.
export async function GET(request: NextRequest) {
  const fail = (code: string) => NextResponse.redirect(new URL(`/classroom/sign-in?error=${code}`, request.url));
  try {
    const res = await verifySignInLink(request.nextUrl.searchParams.get("token"));
    if (!res.ok) return fail(res.reason === "invalid" ? "link_expired" : res.reason === "disabled" ? "disabled" : "signup_closed");
    await db().update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, res.userId));
    const out = NextResponse.redirect(new URL(res.next, request.url));
    out.cookies.set(SESSION_COOKIE, await createSessionToken({ userId: res.userId, version: res.version, method: "link" }), sessionCookieOptions);
    out.headers.set("Cache-Control", "no-store");
    return out;
  } catch (error) {
    console.error("[classroom] verify", error instanceof Error ? error.message : error);
    return fail("failed");
  }
}
