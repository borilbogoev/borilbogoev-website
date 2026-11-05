import { notFound } from "next/navigation";
import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { LandingBuilder } from "@/modules/landing/admin/builder";
import { latestForms } from "@/modules/forms/lib/forms";
import { getBlocks, getPage } from "@/modules/landing/lib/pages";
import { listPublicCategories, listPublicCommunities, listPublicPostOptions } from "@/modules/community/server/public";

export const metadata = { title: "Build landing page" };

export default async function BuildLandingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("landing.view");
  const page = await getPage(Number((await params).id));
  if (!page) notFound();
  const [blocks, forms, communities, communityCategories, communityPosts] = await Promise.all([getBlocks(page.id), latestForms(300), listPublicCommunities(), listPublicCategories(), listPublicPostOptions()]);
  return <LandingBuilder pageId={page.id} slug={page.slug} siteUrl={site.url} initialTitle={page.title} initialStatus={page.status} initialBlocks={blocks} settings={page.settings} forms={forms} communities={communities.map((c) => ({ id: c.id, name: c.name }))} communityCategories={communityCategories} communityPosts={communityPosts} canSave={can(user.role, "landing.write")} />;
}
