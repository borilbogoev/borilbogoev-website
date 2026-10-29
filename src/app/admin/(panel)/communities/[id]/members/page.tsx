import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/modules/auth/current";
import { MembersManager } from "@/modules/community/admin/panels";
import { AdminHead } from "@/modules/community/admin/head";
import { listMembers } from "@/modules/community/server/admin";
import { getCommunityById, viewerFor } from "@/modules/community/server/context";
import { toId } from "@/modules/community/server/core";

export const metadata = { title: "Community members" };

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const viewer = await viewerFor(await requireUser("community.manage", `/admin/communities/${raw}/members`));
  const id = toId(raw);
  const c = id ? await getCommunityById(id) : null;
  if (!c) notFound();
  const rows = await listMembers(viewer, c.id, {});
  return (
    <>
      <AdminHead title={`${c.name}: members`} actions={<Link className="bbfa-btn bbfa-btn--ghost" href={`/admin/communities/${c.id}`}>Edit community</Link>} />
      <MembersManager communityId={c.id} initial={rows} isSuper />
    </>
  );
}
