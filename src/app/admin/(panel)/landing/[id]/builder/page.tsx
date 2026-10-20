import { notFound } from "next/navigation";
import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { LandingBuilder } from "@/modules/landing/admin/builder";
import { latestForms } from "@/modules/forms/lib/forms";
import { getBlocks, getPage } from "@/modules/landing/lib/pages";

export const metadata = { title: "Build landing page" };

export default async function BuildLandingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("landing.view");
  const page = await getPage(Number((await params).id));
  if (!page) notFound();
  const [blocks, forms] = await Promise.all([getBlocks(page.id), latestForms(300)]);
  return <LandingBuilder pageId={page.id} slug={page.slug} siteUrl={site.url} initialTitle={page.title} initialStatus={page.status} initialBlocks={blocks} settings={page.settings} forms={forms} canSave={can(user.role, "landing.write")} />;
}
