// The signed-in area. One persistent menu (modules/account/components/nav.tsx) and a slim top bar; no site header or footer.
import type { Metadata } from "next";
import Link from "next/link";
import { Monogram } from "@/components/monogram";
import { accountLogout } from "@/modules/account/actions";
import { AccountNav } from "@/modules/account/components/nav";
import { Avatar } from "@/modules/account/components/ui";
import { getProfile } from "@/modules/account/lib/profile";
import { requireAccountUser } from "@/modules/account/lib/session";
import { canUseAdmin } from "@/modules/auth/roles";

export const metadata: Metadata = { title: { default: "My account", template: "%s | My account" }, robots: { index: false, follow: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAccountUser();
  const profile = await getProfile(user.id);
  return (
    <div className="ac-shell">
      <header className="ac-top">
        <Link href="/account" className="ac-top__brand" aria-label="My account home">
          <Monogram height={28} />
          <span className="ac-top__label">My account</span>
        </Link>
        <Link href="/account/info" className="ac-top__who" style={{ color: "inherit", textDecoration: "none" }}>
          <Avatar name={user.name || user.email} url={profile?.avatarUrl} size={36} />
          <span>{user.name || user.email}</span>
        </Link>
      </header>
      <div className="ac-body">
        <AccountNav admin={canUseAdmin(user.role)} logout={accountLogout} />
        <main className="ac-main" id="main">
          {children}
        </main>
      </div>
    </div>
  );
}
