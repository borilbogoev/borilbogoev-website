import { Suspense } from "react";
import { isGoogleConfigured } from "@/modules/auth/google";
import { LoginForm } from "./login-form";
import "@/modules/forms/admin/admin.css";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
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
