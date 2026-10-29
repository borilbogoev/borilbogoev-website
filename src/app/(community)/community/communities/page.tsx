import Link from "next/link";
import { CommunityJoinCard } from "@/modules/community/components/community-card";
import { listCommunities } from "@/modules/community/server/communities";
import { requireViewer } from "@/modules/community/server/page";
import { t } from "@/modules/community/strings";

export const metadata = { title: "Communities" };

export default async function CommunitiesPage() {
  const viewer = await requireViewer();
  const list = await listCommunities(viewer);
  return (
    <div className="cm-page">
      <header className="cm-head">
        <p className="eyebrow">{t.eyebrow.communities}</p>
        <h1>
          Communities<span className="accent">.</span>
        </h1>
      </header>
      {list.length ? (
        <div className="cm-cards">
          {list.map((c) => (
            <CommunityJoinCard key={c.id} c={c} />
          ))}
        </div>
      ) : (
        <div className="cm-empty">
          <h2>{t.community.listEmpty}</h2>
          <Link href="/community" className="bb-btn bb-btn-outline">{t.nav.feed}</Link>
        </div>
      )}
    </div>
  );
}
