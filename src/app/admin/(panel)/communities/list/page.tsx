import Link from "next/link";
import { requireUser } from "@/modules/auth/current";
import { CommunitiesTable } from "@/modules/community/admin/panels";
import { AdminHead } from "@/modules/community/admin/head";
import { listAdminCommunities } from "@/modules/community/server/admin";
import { viewerFor } from "@/modules/community/server/context";

export const metadata = { title: "Communities list" };

export default async function CommunitiesList() {
  const viewer = await viewerFor(await requireUser("community.manage", "/admin/communities/list"));
  const rows = await listAdminCommunities(viewer);
  return (
    <>
      <AdminHead title="Communities" actions={<Link className="bbfa-btn" href="/admin/communities/new">+ New community</Link>} />
      <CommunitiesTable rows={rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, visibility: r.visibility, joinMode: r.joinMode, status: r.status, isDefault: r.isDefault, members: r.members, posts: r.posts }))} />
    </>
  );
}
