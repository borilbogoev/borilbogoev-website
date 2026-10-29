import { notFound } from "next/navigation";
import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { latestForms } from "@/modules/forms/lib/forms";
import { RichPostBuilder } from "@/modules/community/admin/rich-builder";
import { listAdminCommunities } from "@/modules/community/server/admin";
import { listCategories } from "@/modules/community/server/categories";
import { toId, CommunityError } from "@/modules/community/server/core";
import { viewerFor } from "@/modules/community/server/context";
import { getRich } from "@/modules/community/server/rich";

export const metadata = { title: "Rich post builder" };

export default async function RichBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const viewer = await viewerFor(await requireUser("community.manage", `/admin/communities/posts/${raw}`));
  const id = toId(raw);
  if (!id) notFound();
  const post = await getRich(viewer, id).catch((e) => {
    if (e instanceof CommunityError) notFound();
    throw e;
  });
  const communities = await listAdminCommunities(viewer);
  const [categories, forms] = await Promise.all([Promise.all(communities.map((c) => listCategories(c.id, { all: true }))).then((x) => x.flat()), latestForms(300)]);
  return (
    <RichPostBuilder
      postId={post.id}
      initial={{ title: post.title, excerpt: post.excerpt, status: post.status, communityId: post.communityId, categoryId: post.categoryId, blocks: post.blocks as { type: string; settings: Record<string, never> }[] }}
      communities={communities.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
      categories={categories.map((c) => ({ id: c.id, communityId: c.communityId, name: c.name, status: c.status }))}
      forms={forms}
      siteUrl={site.url}
    />
  );
}
