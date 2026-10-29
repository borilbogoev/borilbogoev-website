// Community: the signed-in area for communities, messages and notifications. Its own slim bar, no site header or footer.
import type { Metadata } from "next";
import { CommunityShell } from "@/modules/community/components/shell";
import { requireViewer } from "@/modules/community/server/page";

export const metadata: Metadata = { title: { default: "Community", template: "%s | Community" }, robots: { index: false, follow: false } };

export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  return <CommunityShell viewer={viewer}>{children}</CommunityShell>;
}
