import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/current";
import { assignableRoles, canManageUser, isRole } from "@/modules/auth/roles";
import { filterOptions, getUserDetail } from "@/modules/users/server/query";
import { UserDetailView } from "@/modules/users/admin/user-detail";
import { PageHeader } from "../../header";

export const metadata = { title: "User" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser("users.manage", "/admin/users");
  const detail = await getUserDetail((await params).id);
  if (!detail || !isRole(detail.user.role)) notFound();
  const options = await filterOptions();
  const self = detail.user.id === me.id;
  return (
    <>
      <PageHeader eyebrow="Users" title={<>{detail.user.name || detail.user.email}<span className="bbfa-dot">.</span></>} />
      <UserDetailView key={detail.user.updatedAt} detail={detail} options={options} me={{ id: me.id, role: me.role }} roles={assignableRoles(me.role)} canManage={self || canManageUser(me.role, detail.user.role)} self={self} />
    </>
  );
}
