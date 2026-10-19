import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { db } from "@/db/use";
import { schema } from "@/db";
import { hashPassword, verifyPassword } from "./password";
import { isRole, type Role } from "./roles";
import type { User } from "./schema";

const { users } = schema;

export type PublicUser = Pick<User, "id" | "email" | "name" | "role" | "status" | "lastLoginAt" | "createdAt"> & { hasPassword: boolean };

export const MAX_FAILED_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

export async function getUserById(id: string): Promise<User | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [u] = await db().select().from(users).where(eq(users.id, id)).limit(1);
  return u ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const [u] = await db().select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  return u ?? null;
}

export function toPublic(u: User): PublicUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role, status: u.status, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt, hasPassword: !!u.passwordHash };
}

export async function listUsers(): Promise<PublicUser[]> {
  const rows = await db().select().from(users).orderBy(asc(users.createdAt));
  return rows.map(toPublic);
}

export async function countOwners(excludeId?: string): Promise<number> {
  const where = excludeId ? and(eq(users.role, "owner"), eq(users.status, "active"), ne(users.id, excludeId)) : and(eq(users.role, "owner"), eq(users.status, "active"));
  const [r] = await db().select({ n: count() }).from(users).where(where);
  return r?.n ?? 0;
}

export type NewUser = { email: string; name?: string; role: Role; password?: string | null };

export async function createUser(input: NewUser): Promise<User> {
  const [u] = await db()
    .insert(users)
    .values({
      email: normalizeEmail(input.email),
      name: (input.name ?? "").trim(),
      role: input.role,
      passwordHash: input.password ? await hashPassword(input.password) : null,
    })
    .returning();
  return u;
}

export async function updateUser(id: string, patch: { name?: string; role?: Role; status?: "active" | "disabled"; password?: string }): Promise<User | null> {
  const set: PgUpdateSetSource<typeof users> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name.trim();
  if (patch.role !== undefined && isRole(patch.role)) set.role = patch.role;
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.password) set.passwordHash = await hashPassword(patch.password);
  // Anything that changes who the user is or whether they may sign in ends their current sessions.
  if (patch.role !== undefined || patch.status === "disabled" || patch.password) set.sessionVersion = sql`${users.sessionVersion} + 1`;
  if (patch.password || patch.status === "active") {
    set.failedAttempts = 0;
    set.lockedUntil = null;
  }
  const [u] = await db().update(users).set(set).where(eq(users.id, id)).returning();
  return u ?? null;
}

export async function deleteUser(id: string): Promise<void> {
  await db().delete(users).where(eq(users.id, id));
}

export type AuthResult = { ok: true; user: User } | { ok: false; reason: "invalid" | "locked" | "disabled" };

/**
 * Checks an email and password. Wrong passwords are counted per account and lock it for a while.
 * Bootstrap: while there are no users yet, AUTH_EMAIL + AUTH_PASSWORD_HASH (the same variables
 * BB Command Center uses) create the first owner on a successful sign-in.
 */
export async function authenticate(emailInput: string, password: string): Promise<AuthResult> {
  const email = normalizeEmail(emailInput);
  let user = await getUserByEmail(email);

  if (!user) {
    const [{ n }] = await db().select({ n: count() }).from(users);
    const envEmail = normalizeEmail(process.env.AUTH_EMAIL ?? "");
    if (n === 0 && envEmail && email === envEmail && (await verifyPassword(password, process.env.AUTH_PASSWORD_HASH))) {
      const [created] = await db()
        .insert(users)
        .values({ email, name: "", role: "owner", passwordHash: process.env.AUTH_PASSWORD_HASH })
        .returning();
      user = created;
    } else {
      // Spend the same time as a real check so unknown emails are not distinguishable.
      await hashPassword(password);
      return { ok: false, reason: "invalid" };
    }
  } else {
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) return { ok: false, reason: "locked" };
    const good = await verifyPassword(password, user.passwordHash);
    if (!good) {
      const attempts = user.failedAttempts + 1;
      await db()
        .update(users)
        .set({ failedAttempts: attempts >= MAX_FAILED_ATTEMPTS ? 0 : attempts, lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : user.lockedUntil })
        .where(eq(users.id, user.id));
      return { ok: false, reason: "invalid" };
    }
  }

  if (user.status !== "active") return { ok: false, reason: "disabled" };
  await db().update(users).set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return { ok: true, user };
}

/** Marks a Google sign-in. Only existing, active users get in. */
export async function authenticateGoogle(emailInput: string): Promise<AuthResult> {
  const user = await getUserByEmail(emailInput);
  if (!user) return { ok: false, reason: "invalid" };
  if (user.status !== "active") return { ok: false, reason: "disabled" };
  await db().update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return { ok: true, user };
}
