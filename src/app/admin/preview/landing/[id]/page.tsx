import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/current";
import { LandingView } from "@/modules/landing/components/landing-view";
import { getBlocks, getPage } from "@/modules/landing/lib/pages";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

// The latest saved version of a page, drafts included, with statistics off. Shown inside the admin preview and in its own tab.
export default async function PreviewFrameRoute({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("landing.view");
  const page = await getPage(Number((await params).id));
  if (!page) notFound();
  return <LandingView page={page} blocks={await getBlocks(page.id)} preview />;
}
