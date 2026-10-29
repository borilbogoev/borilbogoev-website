import { requireUser } from "@/modules/auth/current";
import { SuspensionsManager } from "@/modules/community/admin/panels";
import { AdminHead } from "@/modules/community/admin/head";
import { listSuspensions } from "@/modules/community/server/safety";

export const metadata = { title: "Community suspensions" };

export default async function SuspensionsPage() {
  await requireUser("community.manage", "/admin/communities/suspensions");
  const rows = await listSuspensions();
  return (
    <>
      <AdminHead title="Suspensions" />
      <p className="bbfa-muted" style={{ marginTop: -8, marginBottom: 20 }}>A suspended person can read Community but cannot post, comment, message or mention anyone.</p>
      <SuspensionsManager initial={rows.map((r) => ({ id: r.id, userId: r.userId, name: r.name, email: r.email, reason: r.reason ?? "", createdAt: r.createdAt.toISOString(), liftedAt: r.liftedAt ? r.liftedAt.toISOString() : null }))} />
    </>
  );
}
