import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/modules/auth/current";
import { CommunityForm } from "@/modules/community/admin/panels";
import { AdminHead } from "@/modules/community/admin/head";
import { toId } from "@/modules/community/server/core";
import { getCommunityById } from "@/modules/community/server/context";

export const metadata = { title: "Edit community" };

export default async function EditCommunity({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  await requireUser("community.manage", `/admin/communities/${raw}`);
  const id = toId(raw);
  const c = id ? await getCommunityById(id) : null;
  if (!c) notFound();
  return (
    <>
      <AdminHead title={c.name} actions={<Link className="bbfa-btn bbfa-btn--ghost" href={`/admin/communities/${c.id}/members`}>Members</Link>} />
      <CommunityForm initial={{ id: c.id, slug: c.slug, name: c.name, description: c.description ?? "", iconUrl: c.iconUrl ?? "", coverUrl: c.coverUrl ?? "", visibility: c.visibility, joinMode: c.joinMode, status: c.status, defaultSort: c.defaultSort }} />
    </>
  );
}
