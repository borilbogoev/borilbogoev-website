import Link from "next/link";
import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { PagesTable } from "@/modules/landing/admin/pages-table";
import { listPages } from "@/modules/landing/lib/pages";
import { overview } from "@/modules/landing/lib/stats";
import { PageHeader } from "../header";

export const metadata = { title: "Landing pages" };

export default async function LandingListPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser("landing.view", "/admin/landing");
  const { q = "" } = await searchParams;
  const [pages, totals] = await Promise.all([listPages(q), overview()]);
  const canWrite = can(user.role, "landing.write");
  const n = (v: number) => v.toLocaleString("en-US");
  return (
    <>
      <PageHeader
        eyebrow="Landing pages"
        title={
          <>
            Pages<span className="bbfa-dot">.</span>
          </>
        }
        actions={canWrite ? <Link className="bbfa-btn" href="/admin/landing/new">+ New page</Link> : null}
      />
      <section className="bbfa-band">
        <div><strong>{n(totals.pages)}</strong><span>Pages</span></div>
        <div><strong>{n(totals.published)}</strong><span>Published</span></div>
        <div><strong>{n(totals.views)}</strong><span>Views, last 30 days</span></div>
        <div><strong>{n(totals.unique)}</strong><span>Unique views</span></div>
        <div><strong>{n(totals.clicks)}</strong><span>Clicks</span></div>
        <div>
          <strong>
            {totals.ctr === null ? "–" : <>{totals.ctr}<i>%</i></>}
          </strong>
          <span>Click-through rate</span>
        </div>
      </section>
      <section className="bbfa-section">
        <div className="bbfa-section__head">
          <div>
            <div className="bbfa-eyebrow">Library</div>
            <h2>All pages</h2>
          </div>
          <form method="get" className="bbfa-search">
            <input type="search" name="q" defaultValue={q} placeholder="Search pages..." />
          </form>
        </div>
        {pages.length ? (
          <PagesTable
            canWrite={canWrite}
            canDelete={can(user.role, "landing.delete")}
            siteUrl={site.url}
            rows={pages.map((p) => ({ id: p.id, title: p.title, slug: p.slug, status: p.status, updatedAt: p.updatedAt.toISOString(), publishedAt: p.publishedAt?.toISOString() ?? null, views: p.views, unique: p.unique, clicks: p.clicks }))}
          />
        ) : (
          <div className="bbfa-empty">
            <div className="bbfa-empty__icon">
              B<i>*</i>
            </div>
            <h3>{q ? "No pages match your search." : "Systems always win. Build your first page."}</h3>
            <p>Start from a template or a blank canvas. Every page lives at {site.url.replace(/^https?:\/\//, "")}/l/&lt;name&gt;.</p>
            {canWrite ? <Link className="bbfa-btn" href="/admin/landing/new">+ Create a page</Link> : null}
          </div>
        )}
      </section>
    </>
  );
}
