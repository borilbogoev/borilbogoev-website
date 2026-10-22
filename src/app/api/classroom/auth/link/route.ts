import { json } from "@/modules/auth/guard";
import { sendSignInLink } from "@/modules/classroom/lib/signin";

export const runtime = "nodejs";

// Sends the sign-in link. The answer never says whether the address has an account.
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string; name?: string; next?: string };
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const res = await sendSignInLink({ email: body.email, name: body.name, next: body.next, origin: new URL(request.url).origin, ip });
    return res.ok ? json({ sent: true }, 200) : json({ error: res.error }, res.status);
  } catch (error) {
    console.error("[classroom] sign-in link", error instanceof Error ? error.message : error);
    return json({ error: "The link could not be sent. Please try again." }, 500);
  }
}
