import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/current";
import { isGoogleConfigured } from "@/modules/auth/google";
import { LoginForm } from "./login-form";
import "@/modules/forms/admin/admin.css";

export const metadata = { title: "Sign in" };

// A signed cookie is not enough to skip the form: only a still-valid account is sent on to the admin.
export default async function LoginPage() {
  if (await getCurrentUser().catch(() => null)) redirect("/admin");
  return (
    <div className="bbfa bbfa-login">
      <div className="bbfa-login__box">
        <div className="bbfa-logo" aria-hidden="true">
          B<i>*</i>
        </div>
        <div className="bbfa-eyebrow" style={{ marginTop: 28 }}>
          Admin
        </div>
        <h1>
          Sign in<span className="bbfa-dot">.</span>
        </h1>
        <Suspense>
          <LoginForm googleEnabled={isGoogleConfigured()} />
        </Suspense>
      </div>
    </div>
  );
}
