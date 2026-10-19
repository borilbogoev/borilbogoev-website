import Link from "next/link";
import { logout } from "@/modules/auth/actions";
import { requireUser } from "@/modules/auth/current";
import { can, ROLE_LABELS } from "@/modules/auth/roles";
import { AdminProviders } from "@/modules/forms/admin/providers";
import { getGlobalSettings } from "@/modules/forms/lib/settings-store";
import { AdminNav } from "./nav";

// Everything in the admin needs a signed-in user. Pages add their own permission check on top.
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const timeZone = await getGlobalSettings().then((g) => g.timezone, () => "UTC");
  return (
    <AdminProviders timeZone={timeZone}>
      <header className="bbfa-bar">
        <div className="bbfa-bar__inner">
          <Link className="bbfa-logo" href="/admin" aria-label="Admin home">
            B<i>*</i>
          </Link>
          <AdminNav showUsers={can(user.role, "users.manage")} showSettings={can(user.role, "forms.settings")} />
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
