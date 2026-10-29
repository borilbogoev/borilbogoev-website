import Link from "next/link";
import { PageHead } from "@/modules/account/components/ui";
import { requireAccountUser } from "@/modules/account/lib/session";
import { ProfileView } from "@/modules/community/components/profile-view";
import "@/modules/community/components/community.css";
import { ensureDefaultMembership, viewerFor } from "@/modules/community/server/context";

export const metadata = { title: "Community" };

export default async function AccountCommunityPage({ searchParams }: { searchParams: Promise<{ section?: string; community?: string }> }) {
  const user = await requireAccountUser();
  await ensureDefaultMembership(user.id);
  const viewer = await viewerFor(user);
  const sp = await searchParams;
  return (
    <>
      <PageHead eyebrow="Community" title="My Community" intro="Your posts, comments, mentions and conversations." />
      <p style={{ margin: "-8px 0 24px" }}>
        <Link href="/community" className="bb-btn bb-btn-primary">
          Open the community feed and write a post
        </Link>
      </p>
      <ProfileView viewer={viewer} targetId={user.id} base="/account/community" section={sp.section} community={sp.community} />
    </>
  );
}
