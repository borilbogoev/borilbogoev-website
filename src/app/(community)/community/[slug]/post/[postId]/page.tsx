import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CommentSection } from "@/modules/community/components/comments";
import { Banner, writeBlock } from "@/modules/community/components/community-view";
import { PostCard } from "@/modules/community/components/post-card";
import { listComments } from "@/modules/community/server/comments";
import { toId } from "@/modules/community/server/core";
import { me, pageScopeById, requireViewer } from "@/modules/community/server/page";
import { getPost, getPostRow } from "@/modules/community/server/posts";
import { snippet } from "@/modules/community/lib/text";
import { t } from "@/modules/community/strings";

type Props = { params: Promise<{ slug: string; postId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { postId } = await params;
  const id = toId(postId);
  const row = id ? await getPostRow(id) : null;
  return { title: row && row.status === "published" ? snippet(row.body, 60) || "Post" : "Post" };
}

export default async function PostPage({ params }: Props) {
  const { slug, postId } = await params;
  const viewer = await requireViewer();
  const id = toId(postId);
  const row = id ? await getPostRow(id) : null;
  if (!row || row.status === "deleted") notFound();
  const scope = await pageScopeById(viewer, row.communityId);
  if (scope.community.slug !== slug) redirect(`/community/${scope.community.slug}/post/${row.id}`);
  const found = await getPost(scope, row.id);
  if (!found) notFound();
  const [comments, blocked] = await Promise.all([listComments(scope, row.id, null), Promise.resolve(writeBlock(scope))]);
  const person = me(viewer);
  return (
    <div className="cm-page cm-page--narrow">
      <p className="cm-back">
        <Link href={`/community/${scope.community.slug}`} className="cm-link-btn">← {scope.community.name}</Link>
      </p>
      <p className="eyebrow">{t.eyebrow.post}</p>
      {blocked ? <Banner>{blocked}</Banner> : null}
      <PostCard post={found.item} people={found.people} slug={scope.community.slug} communityId={scope.community.id} meId={viewer.user.id} detail />
      <CommentSection
        postId={row.id}
        communityId={scope.community.id}
        me={{ ...person, ...(found.people[viewer.user.id] ?? {}) }}
        initial={comments.items}
        initialPeople={comments.people}
        initialNext={comments.nextCursor}
        initialCount={found.item.commentCount}
        canComment={!blocked}
        blockedReason=""
      />
    </div>
  );
}
