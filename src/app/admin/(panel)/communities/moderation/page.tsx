import { requireUser } from "@/modules/auth/current";
import { ReportsQueue } from "@/modules/community/admin/panels";
import { AdminHead } from "@/modules/community/admin/head";
import { listReports } from "@/modules/community/server/admin";
import { viewerFor } from "@/modules/community/server/context";
import { listAdminCommunities } from "@/modules/community/server/admin";

export const metadata = { title: "Moderation queue" };

export default async function ModerationPage() {
  const viewer = await viewerFor(await requireUser("community.manage", "/admin/communities/moderation"));
  const [rows, communities] = await Promise.all([listReports(viewer, { status: "open" }), listAdminCommunities(viewer)]);
  return (
    <>
      <AdminHead title="Moderation" />
      <ReportsQueue initial={rows} communities={communities.map((c) => ({ id: c.id, name: c.name }))} isSuper />
    </>
  );
}
