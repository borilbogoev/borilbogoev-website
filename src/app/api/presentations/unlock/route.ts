import { createHash } from "node:crypto";
import { noteFail, passwordValid, tokenValid, tooManyTries, unlockToken } from "@/modules/presentations/lib/access";
import { getDeckBySlug, getTree } from "@/modules/presentations/lib/presentations";

export const runtime = "nodejs";

const reply = (body: object, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Opens a password-protected deck. The answer holds the slides (without speaker notes), so they never sit in public HTML.
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { slug?: unknown; password?: unknown; token?: unknown } | null;
    if (!body || typeof body.slug !== "string") return reply({ error: "Invalid request." }, 400);
    const deck = await getDeckBySlug(body.slug);
    if (!deck || deck.status !== "active" || !deck.passwordHash) return reply({ error: "This presentation is not available." }, 404);

    const who = createHash("sha256").update(`${request.headers.get("x-forwarded-for") ?? ""}|${request.headers.get("user-agent") ?? ""}`).digest("hex").slice(0, 16);
    const key = `${deck.id}:${who}`;
    const viaToken = body.token !== undefined && tokenValid(body.token, deck.id, deck.passwordHash);
    if (!viaToken) {
      if (tooManyTries(key)) return reply({ error: "Too many attempts. Try again in a few minutes." }, 429);
      if (!(await passwordValid(body.password, deck.passwordHash))) {
        noteFail(key);
        return reply({ error: "The password is not right." }, 401);
      }
    }
    const slides = (await getTree(deck.id)).map((s) => ({ ...s, settings: { ...s.settings, notes: "" } }));
    return reply({ deck: { id: deck.id, title: deck.title, slug: deck.slug, mode: deck.mode, orientation: deck.orientation, settings: deck.settings }, slides, token: unlockToken(deck.id, deck.passwordHash) }, 200);
  } catch (error) {
    console.error("[presentations] unlock failed", error instanceof Error ? error.message : error);
    return reply({ error: "Something went wrong. Please try again." }, 500);
  }
}
