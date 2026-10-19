import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/modules/auth/session";

// First gate for the admin area. It only checks the signed cookie; roles and account status are
// re-checked against the database in every page and route handler (see modules/auth/current.ts).
// The public site is not touched by this file, so its pages stay static.
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/api/admin/auth/"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p));
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session && !isPublic) {
    if (pathname.startsWith("/api/")) return Response.json({ error: "Please sign in again." }, { status: 401 });
    const url = new URL("/admin/login", request.url);
    if (pathname !== "/admin") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
