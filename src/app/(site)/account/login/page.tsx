import { Suspense } from "react";
import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/modules/auth/current";
import { isGoogleConfigured } from "@/modules/auth/google";
import { SignInForm } from "@/modules/school/components/sign-in-form";

export const metadata = { ...pageMetadata({ title: "Sign in", description: "Sign in to your account.", path: "/account/login" }), robots: { index: false, follow: false } };

export default async function AccountLoginPage() {
  if (await getCurrentUser().catch(() => null)) redirect("/account");
  return (
    <section className="section hero-soft pb-10 pt-12 md:pb-16 md:pt-20">
      <div className="container-bb">
        <p className="eyebrow">My account</p>
        <h1 className="t-display-lg mt-3">
          Sign in<span className="accent">.</span>
        </h1>
        <p className="t-subtitle mt-5 max-w-[48ch]">Enter your email and we send you a link, or use your password. Your courses, answers and details are inside.</p>
        <Suspense>
          <SignInForm googleEnabled={isGoogleConfigured()} defaultNext="/account" />
        </Suspense>
      </div>
    </section>
  );
}
