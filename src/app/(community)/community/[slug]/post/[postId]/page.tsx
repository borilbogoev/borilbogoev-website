import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CommentSection } from "@/modules/community/components/comments";
import { Banner, writeBlock } from "@/modules/community/components/community-view";
import { RichBody } from "@/modules/community/components/rich-body";
import { listCategories } from "@/modules/community/server/categories";
import { PostCard } from "@/modules/community/components/post-card";
import { listComments } from "@/modules/community/server/comments";
import { toId } from "@/modules/community/server/core";
import { me, pageScopeById, requireViewer } from "@/modules/community/server/page";
import { getPost, getPostRow, markPostRead } from "@/modules/community/server/posts";
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
  const [comments, blocked, cats] = await Promise.all([listComments(scope, row.id, null), Promise.resolve(writeBlock(scope)), listCategories(scope.community.id, { all: viewer.actor.superAdmin }), markPostRead(viewer.user.id, row.id)]);
  const rich = found.item.kind === "rich";
  const locked = found.item.commentsLocked;
  const person = me(viewer);
  return (
    <div className={`cm-page ${rich ? "cm-page--wide" : "cm-page--narrow"}`}>
      <p className="cm-back">
        <Link href={`/community/${scope.community.slug}`} className="cm-link-btn">← {scope.community.name}</Link>
      </p>
      <p className="eyebrow">{t.eyebrow.post}</p>
      {blocked ? <Banner>{blocked}</Banner> : null}
      {row.status === "draft" ? <Banner>This is a draft. Only you can see it. Publish it in the builder.</Banner> : null}
      <PostCard post={found.item} people={found.people} slug={scope.community.slug} communityId={scope.community.id} meId={viewer.user.id} categories={cats} detail>
        {rich && found.item.blocks ? <RichBody blocks={found.item.blocks} /> : null}
      </PostCard>
      <CommentSection
        postId={row.id}
        communityId={scope.community.id}
        me={{ ...person, ...(found.people[viewer.user.id] ?? {}) }}
        initial={comments.items}
        initialPeople={comments.people}
        initialNext={comments.nextCursor}
        initialCount={found.item.commentCount}
        canComment={!blocked && !locked && row.status !== "draft"}
        blockedReason={locked && !blocked ? t.rich.commentsOff : ""}
      />
    </div>
  );
}
