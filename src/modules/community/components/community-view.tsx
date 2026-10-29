import { notFound } from "next/navigation";
import { listFeed } from "../server/posts";
import { listCommunities, memberCounts } from "../server/communities";
import { communityState, memberState, type Scope } from "../server/context";
import { canJoin, canLeave, canPost } from "../server/permissions";
import { t } from "../strings";
import { CommunitySwitcher, JoinButton } from "./community-actions";
import { Feed } from "./feed";

export function Banner({ children }: { children: React.ReactNode }) {
  return <div className="cm-banner" role="status">{children}</div>;
}

/** Why the viewer cannot write here, as one sentence. Empty when they can. */
export function writeBlock(scope: Scope): string {
  const d = canPost(scope.viewer.actor, memberState(scope.membership), communityState(scope.community), scope.settings);
  if (d.ok) return "";
  switch (d.code) {
    case "suspended": return t.community.suspendedBanner;
    case "archived": return t.community.archivedBanner;
    case "paused": return t.community.pausedBanner;
    case "banned": return t.community.bannedBanner;
    case "not_member": return scope.community.joinMode === "closed" ? t.community.closedToPost : t.community.joinToPost;
    default: return "";
  }
}

export async function CommunityView({ scope }: { scope: Scope }) {
  const { viewer, community, membership, settings } = scope;
  if (!community) notFound();
  const [feed, all, counts] = await Promise.all([listFeed(scope, {}), listCommunities(viewer), memberCounts()]);
  const blocked = writeBlock(scope);
  const m = memberState(membership);
  const c = communityState(community);
  return (
    <div className="cm-page">
      <header className="cm-head">
        {community.coverUrl ? <img className="cm-head__cover" src={community.coverUrl} alt="" /> : null}
        <div className="cm-head__row">
          <div>
            <p className="eyebrow">{t.eyebrow.feed}</p>
            <h1>
              {community.name}
              <span className="accent">.</span>
            </h1>
            {community.description ? <p className="cm-head__desc">{community.description}</p> : null}
            <p className="cm-muted">
              {t.community.members(counts.get(community.id) ?? 0)}
              {community.joinMode === "closed" ? ` · ${t.community.closed}` : ""}
              {community.visibility === "hidden" ? ` · ${t.community.hidden}` : ""}
              {community.status === "archived" ? ` · ${t.community.archived}` : ""}
            </p>
          </div>
          <div className="cm-head__actions">
            <CommunitySwitcher current={community.slug} options={all.map((x) => ({ slug: x.slug, name: x.name }))} />
            <JoinButton slug={community.slug} joined={!!membership} canLeave={canLeave(m, community).ok && membership?.status !== "banned"} canJoin={canJoin(viewer.actor, m, c).ok} />
          </div>
        </div>
      </header>
      {blocked ? <Banner>{blocked}</Banner> : null}
      <Feed
        slug={community.slug}
        communityId={community.id}
        meId={viewer.user.id}
        initial={feed.items}
        initialPeople={feed.people}
        initialNext={feed.nextCursor}
        composer={blocked ? null : { maxImages: settings.maxImagesPerPost, maxImageMb: settings.maxImageMb }}
      />
    </div>
  );
}
