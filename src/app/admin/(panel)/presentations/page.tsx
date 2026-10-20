import Link from "next/link";
import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { CategoriesManager, DecksTable } from "@/modules/presentations/admin/decks-table";
import { LibraryTabs } from "@/modules/presentations/admin/tabs";
import { listCategories, listDecks, listTags } from "@/modules/presentations/lib/presentations";
import { DECK_STATUSES, STATUS_LABELS } from "@/modules/presentations/lib/settings";
import { overview } from "@/modules/presentations/lib/stats";
import { PageHeader } from "../header";
import "@/modules/landing/admin/landing-admin.css";
import "@/modules/presentations/admin/presentations-admin.css";

export const metadata = { title: "Presentations" };

type SP = { q?: string; status?: string; category?: string; tag?: string };

export default async function PresentationsListPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("presentations.view", "/admin/presentations");
  const { q = "", status = "", category = "", tag = "" } = await searchParams;
  const [decks, totals, categories, tags] = await Promise.all([listDecks({ q, status, category: Number(category) || undefined, tag }), overview(), listCategories(), listTags()]);
  const canWrite = can(user.role, "presentations.write");
  const n = (v: number) => v.toLocaleString("en-US");
  const filtered = !!(q || status || category || tag);
  return (
    <>
      <PageHeader
        eyebrow="Presentations"
        title={
          <>
            Decks<span className="bbfa-dot">.</span>
          </>
        }
        actions={canWrite ? <Link className="bbfa-btn" href="/admin/presentations/new">+ New presentation</Link> : null}
      />
      <LibraryTabs />
      <section className="bbfa-band">
        <div><strong>{n(totals.decks)}</strong><span>Presentations</span></div>
        <div><strong>{n(totals.active)}</strong><span>Active</span></div>
        <div><strong>{n(totals.slides)}</strong><span>Slides</span></div>
        <div><strong>{totals.avgSlides === null ? "–" : totals.avgSlides}</strong><span>Slides per presentation</span></div>
        <div><strong>{n(totals.views)}</strong><span>Views, last 30 days</span></div>
        <div><strong>{n(totals.unique)}</strong><span>Unique viewers</span></div>
      </section>
      <section className="bbfa-section">
        <div className="bbfa-section__head">
          <div>
            <div className="bbfa-eyebrow">Library</div>
            <h2>{status === "archived" ? "Archived presentations" : "All presentations"}</h2>
          </div>
          <CategoriesManager categories={categories} canWrite={canWrite} canDelete={can(user.role, "presentations.delete")} />
        </div>
        <form method="get" className="bbp-filters">
          <input type="search" name="q" defaultValue={q} placeholder="Search presentations..." className="bbfa-search-input" style={{ height: 36, borderRadius: 999, border: "1.5px solid var(--bbfa-line2)", padding: "0 14px", minWidth: 220 }} />
          <select name="status" defaultValue={status} aria-label="Status">
            <option value="">Any status</option>
            {DECK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select name="category" defaultValue={category} aria-label="Category">
            <option value="">Any category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.decks})
              </option>
            ))}
          </select>
          <select name="tag" defaultValue={tag} aria-label="Tag">
            <option value="">Any tag</option>
            {tags.map((t) => (
              <option key={t.id} value={t.slug}>
                {t.name} ({t.decks})
              </option>
            ))}
          </select>
          <button type="submit" className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm">
            Filter
          </button>
          {filtered ? <Link href="/admin/presentations" className="bbfa-muted">Clear</Link> : null}
        </form>
        {decks.length ? (
          <DecksTable
            canWrite={canWrite}
            canDelete={can(user.role, "presentations.delete")}
            siteUrl={site.url}
            rows={decks.map((d) => ({ id: d.id, title: d.title, slug: d.slug, status: d.status, mode: d.mode, orientation: d.orientation, categoryName: d.categoryName, tags: d.tags, hasPassword: d.hasPassword, slides: d.slides, updatedAt: d.updatedAt.toISOString(), views: d.views, unique: d.unique, avgReach: d.avgReach }))}
          />
        ) : (
          <div className="bbfa-empty">
            <div className="bbfa-empty__icon">
              B<i>*</i>
            </div>
            <h3>{filtered ? "No presentations match." : "Systems always win. Build your first deck."}</h3>
            <p>Start from a talk, a workshop or an accordion explainer. Every deck lives at {site.url.replace(/^https?:\/\//, "")}/p/&lt;name&gt; and fills the browser window.</p>
            {canWrite && !filtered ? <Link className="bbfa-btn" href="/admin/presentations/new">+ Create a presentation</Link> : null}
          </div>
        )}
      </section>
    </>
  );
}
