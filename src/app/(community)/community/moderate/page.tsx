import Link from "next/link";
import { notFound } from "next/navigation";
import { MembersManager, ReportsQueue } from "@/modules/community/admin/panels";
import { ToastHost } from "@/modules/community/admin/frame";
import { listMembers, listReports, moderatedIds } from "@/modules/community/server/admin";
import { getCommunityById } from "@/modules/community/server/context";
import { requireViewer } from "@/modules/community/server/page";
import { db } from "@/modules/community/server/core";
import { schema } from "@/db";
import { asc, inArray } from "drizzle-orm";
import { t } from "@/modules/community/strings";
import "@/modules/forms/admin/admin.css";
import "@/modules/landing/admin/landing-admin.css";
import "@/modules/community/admin/admin.css";

export const metadata = { title: "Moderation" };

// The moderators' view: Members and Reports of the communities they moderate. Everything else is in the control panel.
export default async function ModeratePage({ searchParams }: { searchParams: Promise<{ tab?: string; community?: string }> }) {
  const viewer = await requireViewer();
  const ids = await moderatedIds(viewer);
  if (ids !== "all" && !ids.length) notFound();
  const mine = await db().select({ id: schema.communities.id, name: schema.communities.name }).from(schema.communities).where(ids === "all" ? undefined : inArray(schema.communities.id, ids)).orderBy(asc(schema.communities.name));
  if (!mine.length) notFound();
  const sp = await searchParams;
  const current = (await getCommunityById(Number(sp.community) || mine[0].id)) ?? (await getCommunityById(mine[0].id))!;
  const tab = sp.tab === "members" ? "members" : "reports";
  const [reports, members] = await Promise.all([tab === "reports" ? listReports(viewer, { status: "open", communityId: ids === "all" ? current.id : undefined }) : [], tab === "members" ? listMembers(viewer, current.id, {}) : []]);
  return (
    <div className="cm-page bbfa-screen">
      <header className="cm-head">
        <p className="eyebrow">{t.eyebrow.moderate}</p>
        <h1>Moderation<span className="accent">.</span></h1>
      </header>
      <div className="bbfa">
        <nav className="bbfa-tabs" aria-label="Moderation">
          <Link href={`/community/moderate?tab=reports&community=${current.id}`} className={tab === "reports" ? "is-active" : ""}>Reports</Link>
          <Link href={`/community/moderate?tab=members&community=${current.id}`} className={tab === "members" ? "is-active" : ""}>Members</Link>
        </nav>
        {mine.length > 1 ? (
          <form className="cm-adm-filters" method="get">
            <input type="hidden" name="tab" value={tab} />
            <select name="community" defaultValue={current.id} aria-label="Community">{mine.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" type="submit">Show</button>
          </form>
        ) : null}
        {tab === "reports" ? <ReportsQueue key={current.id} initial={reports} communities={mine} isSuper={viewer.actor.superAdmin} /> : <MembersManager key={current.id} communityId={current.id} initial={members} isSuper={false} />}
      </div>
      <ToastHost />
    </div>
  );
}
