import Link from "next/link";
import { Monogram } from "@/components/monogram";
import { accountLogout } from "@/modules/account/actions";
import { AccountNav } from "@/modules/account/components/nav";
import { Avatar } from "@/modules/account/components/ui";
import { getProfile } from "@/modules/account/lib/profile";
import { canUseAdmin } from "@/modules/auth/roles";
import { moderatedIds } from "../server/admin";
import { unreadConversations } from "../server/chat";
import type { Viewer } from "../server/context";
import { unreadCount } from "../server/notifications";
import { t } from "../strings";
import { MessagesBadge, NotificationBell } from "./badges";
import { Toaster } from "./toast";
import "./community.css";

/** The frame of every Community page: brand, the few places you can go, the bell and the messages badge, and the same account menu as /account (shared AccountNav). */
export async function CommunityShell({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  const [bell, chats, profile, mod] = await Promise.all([unreadCount(viewer.user.id), unreadConversations(viewer), getProfile(viewer.user.id), moderatedIds(viewer)]);
  const moderates = mod === "all" || mod.length > 0;
  const name = viewer.user.name || viewer.user.email;
  return (
    <div className="cm-shell">
      <a href="#main" className="cm-skip">{t.a11y.skip}</a>
      <header className="cm-top">
        <div className="cm-top__inner">
          <Link href="/community" className="cm-top__brand" aria-label="Community home">
            <Monogram height={28} />
            <span className="cm-top__label">{t.brand}</span>
          </Link>
          <nav className="cm-nav" aria-label="Community">
            <Link href="/community">{t.nav.feed}</Link>
            <Link href="/community/communities">{t.nav.communities}</Link>
            {moderates ? <Link href={viewer.actor.superAdmin ? "/admin/communities" : "/community/moderate"}>{t.nav.moderate}</Link> : null}
          </nav>
          <div className="cm-top__tools">
            <MessagesBadge initial={chats} />
            <NotificationBell initial={bell} />
            <Link href="/account/community" className="cm-top__who" aria-label="My profile">
              <Avatar name={name} url={profile?.avatarUrl} size={34} />
            </Link>
          </div>
        </div>
      </header>
      <div className="ac-body cm-body">
        <AccountNav admin={canUseAdmin(viewer.user.role)} logout={accountLogout} />
        <main id="main" className="ac-main cm-main">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
