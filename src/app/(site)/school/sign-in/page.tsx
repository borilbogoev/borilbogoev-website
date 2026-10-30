import { Suspense } from "react";
import { pageMetadata } from "@/lib/seo";
import { isGoogleConfigured } from "@/modules/auth/google";
import { SignInForm } from "@/modules/school/components/sign-in-form";

export const metadata = { ...pageMetadata({ title: "Sign in to the School", description: "Sign in or create your student account.", path: "/school/sign-in" }), robots: { index: false, follow: false } };

export default function SignInPage() {
  return (
    <section className="section hero-soft pb-10 pt-12 md:pb-16 md:pt-20">
      <div className="container-bb">
        <p className="eyebrow">School</p>
        <h1 className="t-display-lg mt-3">
          Sign in<span className="accent">.</span>
        </h1>
        <p className="t-subtitle mt-5 max-w-[48ch]">New to the School, or coming back? Pick the side that fits.</p>
        <Suspense>
          <SignInForm googleEnabled={isGoogleConfigured()} />
        </Suspense>
      </div>
    </section>
  );
}
