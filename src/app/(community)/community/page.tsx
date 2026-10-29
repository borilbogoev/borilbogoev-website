import { notFound } from "next/navigation";
import { CommunityView } from "@/modules/community/components/community-view";
import { getDefaultCommunity } from "@/modules/community/server/context";
import { pageScopeById, requireViewer } from "@/modules/community/server/page";

export const metadata = { title: "Feed" };

export default async function CommunityHome() {
  const viewer = await requireViewer();
  const def = await getDefaultCommunity();
  if (!def) notFound();
  return <CommunityView scope={await pageScopeById(viewer, def.id)} />;
}
