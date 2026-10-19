import { guarded, json } from "@/modules/auth/guard";
import { MIN_PASSWORD_LENGTH } from "@/modules/auth/password";
import { assignableRoles, isRole } from "@/modules/auth/roles";
import { cleanEmail } from "@/modules/forms/lib/sanitize";
import { createUser, getUserByEmail, listUsers, toPublic } from "@/modules/auth/users";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return guarded(request, "users.manage", async () => json({ users: await listUsers() }, 200));
}

export async function POST(request: Request) {
  return guarded(request, "users.manage", async (actor) => {
    const body = (await request.json().catch(() => ({}))) as { email?: string; name?: string; role?: string; password?: string };
    const email = cleanEmail(body.email).toLowerCase();
    if (!email) return json({ error: "Enter a valid email address." }, 400);
    if (!isRole(body.role) || !assignableRoles(actor.role).includes(body.role)) return json({ error: "You cannot assign this role." }, 403);
    const password = String(body.password ?? "");
    if (password && password.length < MIN_PASSWORD_LENGTH) return json({ error: `The password needs at least ${MIN_PASSWORD_LENGTH} characters.` }, 400);
    if (await getUserByEmail(email)) return json({ error: "A user with this email already exists." }, 409);
    const user = await createUser({ email, name: String(body.name ?? "").slice(0, 120), role: body.role, password: password || null });
    return json({ user: toPublic(user) }, 201);
  });
}
