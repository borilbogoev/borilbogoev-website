import Link from "next/link";
import { Avatar } from "@/modules/account/components/ui";
import { ConversationList } from "./chat";
import { ProfileList, type Item } from "./profile-list";
import { ProfileMenu, StartChatButton } from "./user-actions";
import { ProfileFilter } from "./profile-filter";
import { listConversations } from "../server/chat";
import type { Viewer } from "../server/context";
import { loadPeople } from "../server/people";
import { filterCommunities, profileComments, profileMentions, profilePosts, type ProfilePage } from "../server/profile";
import { hasBlocked } from "../server/safety";
import { t } from "../strings";

const SECTIONS = ["posts", "comments", "mentions", "conversations"] as const;
type Section = (typeof SECTIONS)[number];

/**
 * The Community tab of a profile, shared by /account/community (the owner) and /community/u/<id> (everyone else).
 * The owner sees Posts, Comments, Mentions and Conversations; others see the first three, filtered by what THEY may see.
 */
export async function ProfileView({ viewer, targetId, base, section: rawSection, community }: { viewer: Viewer; targetId: string; base: string; section?: string; community?: string }) {
  const own = viewer.user.id === targetId;
  const people = await loadPeople([targetId]);
  const person = people[targetId] ?? { id: targetId, name: "Member", username: "", avatarUrl: "" };
  const sections: Section[] = own ? [...SECTIONS] : ["posts", "comments", "mentions"];
  const section: Section = sections.includes(rawSection as Section) ? (rawSection as Section) : "posts";
  const communityId = Number(community) || null;
  const [communities, blocked] = await Promise.all([filterCommunities(viewer), own ? Promise.resolve(false) : hasBlocked(viewer.user.id, targetId)]);

  let page: ProfilePage = { items: [], nextCursor: null, people: {} };
  if (section !== "conversations") {
    const q = { viewer, targetId, communityId };
    page = section === "comments" ? await profileComments(q) : section === "mentions" ? await profileMentions(q) : await profilePosts(q);
  }
  const convs = section === "conversations" ? await listConversations(viewer) : null;
  const qs = (s: string) => `${base}?section=${s}${communityId ? `&community=${communityId}` : ""}`;
  const empty = { posts: t.profile.emptyPosts, comments: t.profile.emptyComments, mentions: t.profile.emptyMentions, conversations: t.profile.emptyConversations }[section];

  return (
    <div className="cm-profile">
      {!own ? (
        <header className="cm-profile__head">
          <Avatar name={person.name} url={person.avatarUrl} size={72} />
          <div>
            <p className="eyebrow">{t.eyebrow.profile}</p>
            <h1>{person.name}<span className="accent">.</span></h1>
            {person.username ? <p className="cm-muted">@{person.username}</p> : null}
          </div>
          <div className="cm-profile__actions">
            <StartChatButton userId={targetId} className="bb-btn bb-btn-primary" />
            <ProfileMenu userId={targetId} blocked={blocked} />
          </div>
        </header>
      ) : null}
      <nav className="cm-tabs" aria-label="Community sections">
        {sections.map((s) => (
          <Link key={s} href={qs(s)} aria-current={s === section ? "page" : undefined}>
            {t.profile.tabs[s]}
          </Link>
        ))}
      </nav>
      {section !== "conversations" && communities.length > 1 ? <ProfileFilter base={base} section={section} value={communityId} options={communities} /> : null}
      {section === "conversations" && convs ? (
        <ConversationList initial={convs.items} initialPeople={convs.people} />
      ) : (
        <ProfileList key={`${section}-${communityId}`} userId={targetId} section={section} communityId={communityId} initial={page.items as Item[]} initialNext={page.nextCursor} initialPeople={page.people} empty={empty} />
      )}
    </div>
  );
}
