import { notFound, redirect } from "next/navigation";
import { ProfileView } from "@/modules/community/components/profile-view";
import { isUuid } from "@/modules/community/server/core";
import { requireViewer } from "@/modules/community/server/page";
import { loadPeople } from "@/modules/community/server/people";

export const metadata = { title: "Profile" };

export default async function PersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ section?: string; community?: string }> }) {
  const viewer = await requireViewer();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const sp = await searchParams;
  if (id.toLowerCase() === viewer.user.id) redirect(`/account/community${sp.section ? `?section=${sp.section}` : ""}`);
  if (!(await loadPeople([id]))[id]) notFound();
  return (
    <div className="cm-page cm-page--narrow">
      <ProfileView viewer={viewer} targetId={id.toLowerCase()} base={`/community/u/${id}`} section={sp.section} community={sp.community} />
    </div>
  );
}
