import { guarded, json } from "@/modules/auth/guard";
import { MIN_PASSWORD_LENGTH } from "@/modules/auth/password";
import { assignableRoles, canManageUser, isRole, type Role } from "@/modules/auth/roles";
import { countOwners, deleteUser, getUserById, toPublic, updateUser } from "@/modules/auth/users";
import { saveProfile, type ProfileInput } from "@/modules/account/lib/profile";
import { cleanEmail } from "@/modules/forms/lib/sanitize";
import { db } from "@/db/use";
import { schema } from "@/db";
import { eq, sql } from "drizzle-orm";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  return guarded(request, "users.manage", async (actor) => {
    const target = await getUserById((await ctx.params).id);
    if (!target || !isRole(target.role)) return json({ error: "User not found." }, 404);
    const isSelf = target.id === actor.id;
    if (!isSelf && !canManageUser(actor.role, target.role)) return json({ error: "You cannot change this user." }, 403);

    const body = (await request.json().catch(() => ({}))) as { name?: string; role?: string; status?: string; password?: string; email?: string; profile?: ProfileInput; unlock?: boolean; signout?: boolean };
    const patch: Parameters<typeof updateUser>[1] = {};
    if (typeof body.name === "string") patch.name = body.name.slice(0, 120);
    if (body.role !== undefined) {
      if (!isRole(body.role) || !assignableRoles(actor.role).includes(body.role)) return json({ error: "You cannot assign this role." }, 403);
      if (isSelf && body.role !== actor.role) return json({ error: "You cannot change your own role." }, 400);
      patch.role = body.role as Role;
    }
    if (body.status !== undefined) {
      if (body.status !== "active" && body.status !== "disabled") return json({ error: "Invalid status." }, 400);
      if (isSelf && body.status === "disabled") return json({ error: "You cannot disable your own account." }, 400);
      patch.status = body.status;
    }
    if (body.password) {
      if (String(body.password).length < MIN_PASSWORD_LENGTH) return json({ error: `The password needs at least ${MIN_PASSWORD_LENGTH} characters.` }, 400);
      patch.password = String(body.password);
    }
    // Never leave the app without an active owner.
    if (target.role === "owner" && ((patch.role && patch.role !== "owner") || patch.status === "disabled") && (await countOwners(target.id)) === 0) {
      return json({ error: "There must be at least one active owner." }, 400);
    }
    if (typeof body.email === "string" && body.email.trim().toLowerCase() !== target.email) {
      const email = cleanEmail(body.email).toLowerCase();
      if (!email) return json({ error: "Enter a valid email address." }, 400);
      const [clash] = await db().select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
      if (clash) return json({ error: "A user with this email already exists." }, 409);
      await db().update(schema.users).set({ email, updatedAt: new Date() }).where(eq(schema.users.id, target.id));
    }
    // The whole profile (name, username, phone, company, job title, country, time zone, bio), validated like My Info.
    if (body.profile && typeof body.profile === "object") {
      const saved = await saveProfile(target.id, body.profile);
      if (!saved.ok) return json({ error: saved.error }, 400);
    }
    if (body.unlock) await db().update(schema.users).set({ failedAttempts: 0, lockedUntil: null }).where(eq(schema.users.id, target.id));
    if (body.signout) await db().update(schema.users).set({ sessionVersion: sql`${schema.users.sessionVersion} + 1` }).where(eq(schema.users.id, target.id));
    const updated = await updateUser(target.id, patch);
    return json({ user: updated ? toPublic(updated) : null }, 200);
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return guarded(request, "users.manage", async (actor) => {
    const target = await getUserById((await ctx.params).id);
    if (!target || !isRole(target.role)) return json({ error: "User not found." }, 404);
    if (target.id === actor.id) return json({ error: "You cannot delete your own account." }, 400);
    if (!canManageUser(actor.role, target.role)) return json({ error: "You cannot delete this user." }, 403);
    if (target.role === "owner" && (await countOwners(target.id)) === 0) return json({ error: "There must be at least one active owner." }, 400);
    await deleteUser(target.id);
    return json({ deleted: true }, 200);
  });
}
