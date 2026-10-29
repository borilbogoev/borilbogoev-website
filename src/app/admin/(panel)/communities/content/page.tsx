import { requireUser } from "@/modules/auth/current";
import { ContentTools } from "@/modules/community/admin/panels";
import { AdminHead } from "@/modules/community/admin/head";
import { listAdminCommunities } from "@/modules/community/server/admin";
import { viewerFor } from "@/modules/community/server/context";

export const metadata = { title: "Community content tools" };

export default async function ContentPage() {
  const viewer = await viewerFor(await requireUser("community.manage", "/admin/communities/content"));
  const communities = await listAdminCommunities(viewer);
  return (
    <>
      <AdminHead title="Content" />
      <ContentTools communities={communities.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))} />
    </>
  );
}
