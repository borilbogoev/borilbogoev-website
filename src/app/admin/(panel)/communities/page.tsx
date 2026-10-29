import { requireUser } from "@/modules/auth/current";
import { AdminHead } from "@/modules/community/admin/head";
import { overview } from "@/modules/community/server/admin";
import { viewerFor } from "@/modules/community/server/context";

export const metadata = { title: "Communities" };

export default async function CommunitiesOverview() {
  const viewer = await viewerFor(await requireUser("community.manage", "/admin/communities"));
  const o = await overview(viewer);
  const n = (v: number) => v.toLocaleString("en-US");
  return (
    <>
      <AdminHead title="Overview" />
      <section className="bbfa-band">
        <div><strong>{n(o.communities)}</strong><span>Communities</span></div>
        <div><strong>{n(o.members)}</strong><span>Active memberships</span></div>
        <div><strong>{n(o.posts7)}</strong><span>Posts, last 7 days</span></div>
        <div><strong>{n(o.comments7)}</strong><span>Comments, last 7 days</span></div>
        <div><strong>{n(o.openReports)}</strong><span>Open reports</span></div>
      </section>
      <section className="bbfa-section">
        <div className="bbfa-section__head"><div><div className="bbfa-eyebrow">Audit log</div><h2>Last 50 admin actions</h2></div></div>
        {o.log.length ? (
          <ul className="cm-adm-log">
            {o.log.map((l) => (
              <li key={l.id}>
                <time dateTime={l.createdAt.toISOString()}>{l.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</time>
                <strong>{l.actor || l.actorEmail || "Unknown"}</strong>
                <span>{l.action} · {l.targetType} {l.targetId}</span>
              </li>
            ))}
          </ul>
        ) : <p className="bbfa-muted">Nothing yet.</p>}
      </section>
    </>
  );
}
