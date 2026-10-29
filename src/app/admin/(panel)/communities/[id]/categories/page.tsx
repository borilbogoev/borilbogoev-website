import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/current";
import { AdminHead } from "@/modules/community/admin/head";
import { CategoriesManager } from "@/modules/community/admin/rich-panels";
import { listCategories } from "@/modules/community/server/categories";
import { getCommunityById } from "@/modules/community/server/context";
import { toId } from "@/modules/community/server/core";

export const metadata = { title: "Community categories" };

export default async function CategoriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  await requireUser("community.manage", `/admin/communities/${raw}/categories`);
  const id = toId(raw);
  const c = id ? await getCommunityById(id) : null;
  if (!c) notFound();
  const rows = await listCategories(c.id, { all: true });
  return (
    <>
      <AdminHead title={`${c.name}: categories`} actions={<Link className="bbfa-btn bbfa-btn--ghost" href={`/admin/communities/${c.id}`}>Edit community</Link>} />
      <p className="bbfa-muted" style={{ marginTop: -8, marginBottom: 20 }}>Published categories are the tabs of the feed, after &ldquo;All&rdquo;. Each has its own default sorting; the &ldquo;All&rdquo; feed is set on the community&rsquo;s edit page.</p>
      <CategoriesManager communityId={c.id} initial={rows} />
    </>
  );
}
