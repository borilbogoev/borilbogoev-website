import { notFound } from "next/navigation";
import { AvatarEditor, PasswordForm, ProfileForm } from "@/modules/account/components/forms";
import { fmtDateTime, PageHead } from "@/modules/account/components/ui";
import { getProfile } from "@/modules/account/lib/profile";
import { requireAccountUser } from "@/modules/account/lib/session";
import { ROLE_LABELS, isRole } from "@/modules/auth/roles";

export const metadata = { title: "My Info" };

export default async function InfoPage() {
  const user = await requireAccountUser();
  const p = await getProfile(user.id);
  if (!p) notFound();
  return (
    <>
      <PageHead eyebrow="My Info" title="My details" intro="Keep your details current. Only you and the site owner can see them." />
      <AvatarEditor name={p.name || p.email} url={p.avatarUrl} />
      <ProfileForm p={p} />
      <PasswordForm hasPassword={p.hasPassword} />
      <section className="ac-panel" aria-label="Account">
        <h2>Account</h2>
        <p>Facts about your account. They are set by the system.</p>
        <dl className="ac-dl">
          <div>
            <dt>Account type</dt>
            <dd>{isRole(p.role) ? ROLE_LABELS[p.role] : p.role}</dd>
          </div>
          <div>
            <dt>Member since</dt>
            <dd>{fmtDateTime(p.createdAt)}</dd>
          </div>
          <div>
            <dt>Last sign-in</dt>
            <dd>{p.lastLoginAt ? fmtDateTime(p.lastLoginAt) : "This is your first visit"}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
