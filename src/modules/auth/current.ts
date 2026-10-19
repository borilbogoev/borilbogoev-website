import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserById, toPublic, type PublicUser } from "./users";
import { can, isRole, type Permission, type Role } from "./roles";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export type CurrentUser = PublicUser & { role: Role };

/**
 * The signed-in user, read from the database on every request: a valid cookie is not enough,
 * the account must still be active and the session version must match.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const claims = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const user = await getUserById(claims.userId);
  if (!user || user.status !== "active" || user.sessionVersion !== claims.version || !isRole(user.role)) return null;
  return { ...toPublic(user), role: user.role };
});

/** For pages: redirects to the login page when signed out and shows "forbidden" when the role is not enough. */
export async function requireUser(permission?: Permission, next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/admin/login?next=${encodeURIComponent(next)}` : "/admin/login");
  if (permission && !can(user.role, permission)) redirect("/admin?denied=1");
  return user;
}

export class ApiAuthError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}

/** For route handlers and server actions: throws ApiAuthError, which `apiGuard` turns into a response. */
export async function requireApiUser(permission?: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiAuthError(401, "Please sign in again.");
  if (permission && !can(user.role, permission)) throw new ApiAuthError(403, "Your role does not allow this.");
  return user;
}
