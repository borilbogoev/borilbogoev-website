"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/modules/auth/current";
import { MIN_PASSWORD_LENGTH, verifyPassword } from "@/modules/auth/password";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/modules/auth/session";
import { getUserById, updateUser } from "@/modules/auth/users";
import { saveProfile } from "./lib/profile";

export type FormState = { ok?: boolean; error?: string; field?: string; message?: string };

export async function saveProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };
  const r = await saveProfile(user.id, Object.fromEntries(formData.entries()));
  if (!r.ok) return { error: r.error, field: r.field };
  revalidatePath("/account", "layout");
  return { ok: true, message: "Saved." };
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const again = String(formData.get("again") ?? "");
  const full = await getUserById(user.id);
  if (!full) return { error: "Please sign in again." };
  if (full.passwordHash && !(await verifyPassword(current, full.passwordHash))) {
    await new Promise((r) => setTimeout(r, 600));
    return { error: "The current password is not right.", field: "current" };
  }
  if (next.length < MIN_PASSWORD_LENGTH) return { error: `The new password needs at least ${MIN_PASSWORD_LENGTH} characters.`, field: "next" };
  if (next !== again) return { error: "The two new passwords do not match.", field: "again" };
  const updated = await updateUser(user.id, { password: next });
  if (!updated) return { error: "Something went wrong. Please try again." };
  // A new password ends every session; keep this one signed in.
  (await cookies()).set(SESSION_COOKIE, await createSessionToken({ userId: updated.id, version: updated.sessionVersion, method: "password" }), sessionCookieOptions);
  return { ok: true, message: full.passwordHash ? "Password changed. Other devices are signed out." : "Password set. You can now sign in with it." };
}

export async function accountLogout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/account/login");
}
