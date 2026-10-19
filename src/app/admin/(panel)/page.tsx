import Link from "next/link";
import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { PageHeader } from "./header";

export const metadata = { title: "Home" };

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const modules = [
    { href: "/admin/forms", title: "Forms", desc: "Build forms, read responses, see how they perform.", show: can(user.role, "forms.view") },
    { href: "/admin/users", title: "Users", desc: "Who can sign in, and what they can do.", show: can(user.role, "users.manage") },
  ].filter((m) => m.show);
  return (
    <>
      <PageHeader eyebrow="Admin" title={<>Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}<span className="bbfa-dot">.</span></>} />
      {denied ? <p className="bbfa-login__error">Your role does not allow that page.</p> : null}
      <div className="bbfa-home">
        {modules.map((m) => (
          <Link key={m.href} href={m.href} className="bbfa-card">
            <div className="bbfa-eyebrow">Module</div>
            <h3>{m.title}</h3>
            <p>{m.desc}</p>
          </Link>
        ))}
        {!modules.length ? <p className="bbfa-muted">Your account has no modules yet. Ask an admin for access.</p> : null}
      </div>
    </>
  );
}
