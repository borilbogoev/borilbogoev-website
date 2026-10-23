import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/modules/auth/actions";
import { requireUser } from "@/modules/auth/current";
import { can, canUseAdmin, ROLE_LABELS } from "@/modules/auth/roles";
import { adminCore, adminModules } from "@/modules/registry";
import { AdminProviders } from "@/modules/forms/admin/providers";
import { getGlobalSettings } from "@/modules/forms/lib/settings-store";
import { AdminNav } from "./nav";

// Everything in the admin needs a signed-in user. Pages add their own permission check on top.
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!canUseAdmin(user.role)) redirect("/school/my"); // students learn in the School, not in the admin
  const timeZone = await getGlobalSettings().then((g) => g.timezone, () => "UTC");
  return (
    <AdminProviders timeZone={timeZone}>
      <header className="bbfa-bar">
        <div className="bbfa-bar__inner">
          <Link className="bbfa-logo" href="/admin" aria-label="Admin home">
            B<i>*</i>
          </Link>
          <AdminNav items={[...adminModules, ...adminCore].filter((m) => can(user.role, m.permission)).map((m) => ({ href: m.href, label: m.label }))} />
          <div className="bbfa-bar__user">
            <span>
              <strong>{user.name || user.email}</strong> · {ROLE_LABELS[user.role]}
            </span>
            <a href="/" target="_blank" rel="noopener noreferrer">
              View site ↗
            </a>
            <form action={logout}>
              <button type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <div className="bbfa">{children}</div>
    </AdminProviders>
  );
}
