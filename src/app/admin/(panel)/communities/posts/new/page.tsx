import { requireUser } from "@/modules/auth/current";
import { AdminHead } from "@/modules/community/admin/head";
import { NewRichForm } from "@/modules/community/admin/rich-panels";
import { listAdminCommunities } from "@/modules/community/server/admin";
import { listCategories } from "@/modules/community/server/categories";
import { viewerFor } from "@/modules/community/server/context";

export const metadata = { title: "New rich post" };

export default async function NewRichPage({ searchParams }: { searchParams: Promise<{ community?: string; category?: string }> }) {
  const viewer = await viewerFor(await requireUser("community.manage", "/admin/communities/posts/new"));
  const sp = await searchParams;
  const communities = await listAdminCommunities(viewer);
  const categories = (await Promise.all(communities.map((c) => listCategories(c.id, { all: true })))).flat();
  return (
    <>
      <AdminHead title="New rich post" />
      <NewRichForm communities={communities.map((c) => ({ id: c.id, name: c.name }))} categories={categories} initialCommunity={Number(sp.community) || 0} initialCategory={Number(sp.category) || null} />
    </>
  );
}
