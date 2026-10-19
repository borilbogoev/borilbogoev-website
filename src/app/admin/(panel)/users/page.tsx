import { requireUser } from "@/modules/auth/current";
import { listUsers } from "@/modules/auth/users";
import { UsersEditor } from "@/modules/forms/admin/users-editor";
import { PageHeader } from "../header";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requireUser("users.manage", "/admin/users");
  const users = await listUsers();
  return (
    <>
      <PageHeader eyebrow="Access" title={<>Users<span className="bbfa-dot">.</span></>} />
      <UsersEditor
        me={{ id: me.id, role: me.role }}
        users={users.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, status: u.status, lastLoginAt: u.lastLoginAt?.toISOString() ?? null, hasPassword: u.hasPassword }))}
      />
    </>
  );
}
