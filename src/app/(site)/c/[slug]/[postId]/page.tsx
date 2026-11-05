import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { site } from "@/content/site";
import { abs, breadcrumbLd, indexable } from "@/lib/seo";
import { PublicComments } from "@/modules/community/components/public-comments";
import { RichBody } from "@/modules/community/components/rich-body";
import { toId } from "@/modules/community/server/core";
import { getPublicPost, publicPostHref } from "@/modules/community/server/public";

// A post of a public community, at /c/<community>/<id>. Static and cached like the rest of the site (no cookies, no headers);
// publishing or editing the post refreshes it at once, and the time below is the safety net. Comments load in the browser.
export const revalidate = 300;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string; postId: string }> };

export async function generateStaticParams() {
  return []; // built on first visit, then cached
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { postId } = await params;
  const id = toId(postId);
  const post = id ? await getPublicPost(id) : null;
  if (!post) return { title: "Post not found", robots: { index: false, follow: false } };
  const url = abs(post.href);
  const description = post.excerpt || undefined;
  return {
    title: { absolute: `${post.title} | ${site.name}` },
    description,
    alternates: { canonical: url },
    robots: indexable ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } } : { index: false, follow: true },
    openGraph: { type: "article", url, title: post.title, description, siteName: site.name, publishedTime: post.createdAt, images: post.cover ? [{ url: post.cover }] : undefined },
    twitter: { card: "summary_large_image", title: post.title, description, images: post.cover ? [post.cover] : undefined },
  };
}

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default async function PublicPostPage({ params }: Props) {
  const { slug, postId } = await params;
  const id = toId(postId);
  const post = id ? await getPublicPost(id) : null;
  if (!post) notFound();
  if (post.communitySlug !== slug) permanentRedirect(publicPostHref(post.communitySlug, post.id));
  return (
    <article className="section pb-16 pt-12 md:pb-24 md:pt-16">
      <div className="container-bb">
        <p className="eyebrow">
          {post.communityName}
          {post.categoryName ? ` · ${post.categoryName}` : ""}
        </p>
        <h1 className="t-display-lg mt-3">
          {post.title.replace(/\.$/, "")}
          <span className="accent">.</span>
        </h1>
        <p className="t-subtitle mt-4">
          <time dateTime={post.createdAt}>{date(post.createdAt)}</time>
        </p>
      </div>
      <div className="mt-8">
        <RichBody blocks={post.blocks} />
      </div>
      <div className="container-bb mt-12 max-w-[760px]">
        <PublicComments postId={post.id} communityId={post.communityId} path={post.href} locked={post.commentsLocked} initialCount={post.commentCount} archived={false} />
        <p className="mt-10">
          <Link href="/" className="cm-link">← {site.name}</Link>
        </p>
      </div>
      <JsonLd
        data={[
          { "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, description: post.excerpt || undefined, datePublished: post.createdAt, dateModified: post.updatedAt, image: post.cover || undefined, url: abs(post.href), author: { "@type": "Person", name: site.name }, mainEntityOfPage: abs(post.href) },
          breadcrumbLd([{ name: site.name, path: "/" }, { name: post.title, path: post.href }]),
        ]}
      />
    </article>
  );
}
