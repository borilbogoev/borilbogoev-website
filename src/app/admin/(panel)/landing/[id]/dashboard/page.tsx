import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/current";
import { LandingDashboardView } from "@/modules/landing/admin/dashboard";
import { getPage } from "@/modules/landing/lib/pages";

export const metadata = { title: "Landing page dashboard" };

export default async function LandingDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("landing.view");
  const page = await getPage(Number((await params).id));
  if (!page) notFound();
  return <LandingDashboardView pageId={page.id} />;
}
