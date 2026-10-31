import { requireUser } from "@/modules/auth/current";
import { assignableRoles } from "@/modules/auth/roles";
import { parseList, filterToParams } from "@/modules/users/lib/filter";
import { filterOptions, listUsersPage } from "@/modules/users/server/query";
import { UsersList } from "@/modules/users/admin/users-list";
import { PageHeader } from "../header";

export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireUser("users.manage", "/admin/users");
  const params = parseList(await searchParams);
  const [list, options] = await Promise.all([listUsersPage(params), filterOptions()]);
  const key = `${filterToParams(params.filter)}|${params.sort}|${params.dir}|${list.page}|${params.perPage}`;
  return (
    <>
      <PageHeader eyebrow="Access" title={<>Users<span className="bbfa-dot">.</span></>} />
      <UsersList key={key} {...list} params={params} options={options} me={{ id: me.id, role: me.role }} roles={assignableRoles(me.role)} />
    </>
  );
}
