import { notFound } from "next/navigation";
import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { PageSettingsEditor } from "@/modules/landing/admin/page-settings";
import { latestForms } from "@/modules/forms/lib/forms";
import { formsUsedBy, getPage } from "@/modules/landing/lib/pages";

export const metadata = { title: "Landing page settings" };

export default async function LandingSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("landing.view");
  const page = await getPage(Number((await params).id));
  if (!page) notFound();
  const [used, all] = await Promise.all([formsUsedBy(page.id), latestForms(300)]);
  return <PageSettingsEditor pageId={page.id} title={page.title} status={page.status} slug={page.slug} settings={page.settings} siteUrl={site.url} usedForms={all.filter((f) => used.includes(f.id))} readOnly={!can(user.role, "landing.write")} />;
}
