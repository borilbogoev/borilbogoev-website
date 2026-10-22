import { Suspense } from "react";
import { pageMetadata } from "@/lib/seo";
import { isGoogleConfigured } from "@/modules/auth/google";
import { SignInForm } from "@/modules/classroom/components/sign-in-form";

export const metadata = { ...pageMetadata({ title: "Sign in to the Classroom", description: "Sign in or create your student account.", path: "/classroom/sign-in" }), robots: { index: false, follow: false } };

export default function SignInPage() {
  return (
    <section className="section hero-soft pb-10 pt-12 md:pb-16 md:pt-20">
      <div className="container-bb">
        <p className="eyebrow">Classroom</p>
        <h1 className="t-display-lg mt-3">
          Sign in<span className="accent">.</span>
        </h1>
        <p className="t-subtitle mt-5 max-w-[48ch]">New or returning, enter your email and we send you a link. No password to remember.</p>
        <Suspense>
          <SignInForm googleEnabled={isGoogleConfigured()} />
        </Suspense>
      </div>
    </section>
  );
}
