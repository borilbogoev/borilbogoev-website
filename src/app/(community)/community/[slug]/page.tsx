import type { Metadata } from "next";
import { CommunityView } from "@/modules/community/components/community-view";
import { pageScopeBySlug, requireViewer } from "@/modules/community/server/page";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const viewer = await requireViewer();
  const { community } = await pageScopeBySlug(viewer, (await params).slug);
  return { title: community.name };
}

export default async function CommunityPage({ params }: Props) {
  const viewer = await requireViewer();
  return <CommunityView scope={await pageScopeBySlug(viewer, (await params).slug)} />;
}
