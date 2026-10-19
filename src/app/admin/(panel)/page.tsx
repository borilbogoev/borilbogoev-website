import Link from "next/link";
import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { adminCore, adminModules } from "@/modules/registry";
import { PageHeader } from "./header";

export const metadata = { title: "Home" };

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const modules = [...adminModules, ...adminCore].filter((m) => can(user.role, m.permission));
  return (
    <>
      <PageHeader eyebrow="Admin" title={<>Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}<span className="bbfa-dot">.</span></>} />
      {denied ? <p className="bbfa-login__error">Your role does not allow that page.</p> : null}
      <div className="bbfa-home">
        {modules.map((m) => (
          <Link key={m.href} href={m.href} className="bbfa-card">
            <div className="bbfa-eyebrow">Module</div>
            <h3>{m.label}</h3>
            <p>{m.desc}</p>
          </Link>
        ))}
        {!modules.length ? <p className="bbfa-muted">Your account has no modules yet. Ask an admin for access.</p> : null}
      </div>
    </>
  );
}
