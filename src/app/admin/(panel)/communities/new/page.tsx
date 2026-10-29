import { requireUser } from "@/modules/auth/current";
import { CommunityForm } from "@/modules/community/admin/panels";
import { AdminHead } from "@/modules/community/admin/head";

export const metadata = { title: "New community" };

export default async function NewCommunity() {
  await requireUser("community.manage", "/admin/communities/new");
  return (
    <>
      <AdminHead title="New community" />
      <CommunityForm initial={{ slug: "", name: "", description: "", iconUrl: "", coverUrl: "", visibility: "listed", joinMode: "open", status: "active", defaultSort: "default" }} />
    </>
  );
}
