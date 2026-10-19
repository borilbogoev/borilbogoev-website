"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authenticate } from "./users";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "./session";
import { safeNext } from "./redirect";

export type LoginState = { error?: string };

export async function loginWithPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));

  let result;
  try {
    result = await authenticate(email, password);
  } catch (error) {
    console.error("[login]", error instanceof Error ? error.message : error);
    return { error: "Sign-in is not available right now. Check the database connection." };
  }
  if (!result.ok) {
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 600));
    if (result.reason === "locked") return { error: "Too many wrong passwords. Try again in 15 minutes." };
    if (result.reason === "disabled") return { error: "This account is disabled." };
    return { error: "Wrong email or password." };
  }

  const token = await createSessionToken({ userId: result.user.id, version: result.user.sessionVersion, method: "password" });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  redirect(next);
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}
