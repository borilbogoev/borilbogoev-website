import Link from "next/link";
import type { CommunityDTO } from "../server/communities";
import { t } from "../strings";
import { JoinButton } from "./community-actions";

export function CommunityJoinCard({ c }: { c: CommunityDTO }) {
  return (
    <article className="cm-card cm-community">
      {c.iconUrl ? <img className="cm-community__icon" src={c.iconUrl} alt="" width={48} height={48} /> : null}
      <div className="cm-community__body">
        <h2>
          <Link href={`/community/${c.slug}`}>{c.name}</Link>
        </h2>
        {c.description ? <p>{c.description}</p> : null}
        <p className="cm-muted">
          {t.community.members(c.members)}
          {c.isDefault ? ` · ${t.community.defaultBadge}` : ""}
          {c.joinMode === "closed" ? ` · ${t.community.closed}` : ""}
          {c.status === "archived" ? ` · ${t.community.archived}` : ""}
        </p>
      </div>
      <div className="cm-community__actions">
        <Link href={`/community/${c.slug}`} className="bb-btn bb-btn-outline cm-btn-sm">{t.action.openCommunity}</Link>
        <JoinButton slug={c.slug} joined={c.joined} canLeave={!c.isDefault && !c.banned} canJoin={c.canJoin} />
      </div>
    </article>
  );
}
