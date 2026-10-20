import { notFound } from "next/navigation";
import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { PreviewFrame } from "@/modules/landing/admin/preview";
import { getPage } from "@/modules/landing/lib/pages";

export const metadata = { title: "Preview landing page" };

export default async function LandingPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("landing.view");
  const page = await getPage(Number((await params).id));
  if (!page) notFound();
  return <PreviewFrame src={`/admin/preview/landing/${page.id}`} publicUrl={`${site.url}/l/${page.slug}`} live={page.status === "published"} />;
}
