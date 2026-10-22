import { cookies } from "next/headers";
import { json } from "@/modules/auth/guard";
import { SESSION_COOKIE } from "@/modules/auth/session";

export const runtime = "nodejs";

export async function POST() {
  (await cookies()).delete(SESSION_COOKIE);
  return json({ signedOut: true }, 200);
}
