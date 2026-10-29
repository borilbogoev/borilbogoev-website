import Link from "next/link";
import { requireUser } from "@/modules/auth/current";
import { AdminHead } from "@/modules/community/admin/head";
import { RichPostsTable } from "@/modules/community/admin/rich-panels";
import { listAdminCommunities } from "@/modules/community/server/admin";
import { viewerFor } from "@/modules/community/server/context";
import { listRich } from "@/modules/community/server/rich";

export const metadata = { title: "Rich posts" };

export default async function RichPostsPage() {
  const viewer = await viewerFor(await requireUser("community.manage", "/admin/communities/posts"));
  const [rows, communities] = await Promise.all([listRich(viewer, {}), listAdminCommunities(viewer)]);
  return (
    <>
      <AdminHead title="Rich posts" actions={<Link className="bbfa-btn" href="/admin/communities/posts/new">+ New rich post</Link>} />
      <p className="bbfa-muted" style={{ marginTop: -8, marginBottom: 20 }}>Posts you build from the landing page blocks: heroes, forms, countdowns, video and more. They show in the feed as a highlighted snippet and open as the built page. Members can like and comment on them.</p>
      <RichPostsTable rows={rows} communities={communities.map((c) => ({ id: c.id, name: c.name }))} />
    </>
  );
}
