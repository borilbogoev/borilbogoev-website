import { requireUser } from "@/modules/auth/current";
import { listTags } from "@/modules/users/server/query";
import { TagsManager } from "@/modules/users/admin/tags-manager";
import { PageHeader } from "../../header";

export const metadata = { title: "User tags" };

export default async function UserTagsPage() {
  await requireUser("users.manage", "/admin/users/tags");
  return (
    <>
      <PageHeader eyebrow="Users" title={<>Tags<span className="bbfa-dot">.</span></>} />
      <TagsManager tags={await listTags()} />
    </>
  );
}
