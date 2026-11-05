import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/current";
import { isSuspended } from "@/modules/community/server/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Who is looking at a public post: lets the static page switch from "Sign in to comment" to the comment box.
export async function GET() {
  const user = await getCurrentUser();
  const headers = { "Cache-Control": "private, no-store" };
  if (!user) return NextResponse.json({ signedIn: false }, { headers });
  return NextResponse.json({ signedIn: true, suspended: await isSuspended(user.id), me: { id: user.id, name: user.name || user.email.split("@")[0], username: "", avatarUrl: "" } }, { headers });
}
