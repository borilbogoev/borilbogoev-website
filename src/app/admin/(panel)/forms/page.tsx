import Link from "next/link";
import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { FormsTable } from "@/modules/forms/admin/forms-table";
import { listForms } from "@/modules/forms/lib/forms";
import { db, rowsOf } from "@/db/use";
import { sql } from "drizzle-orm";
import { PageHeader } from "../header";

export const metadata = { title: "Forms" };

export default async function FormsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser("forms.view", "/admin/forms");
  const { q = "" } = await searchParams;
  const forms = await listForms(q);
  const [t] = rowsOf<{ total: number; last30: number; unread: number }>(
    await db().execute(sql`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS last30, COUNT(*) FILTER (WHERE NOT is_read)::int AS unread FROM bbforms_responses`),
  );
  const active = forms.filter((f) => f.status === "active").length;
  const canWrite = can(user.role, "forms.write");
  return (
    <>
      <PageHeader
        eyebrow="Form builder"
        title={<>Forms<span className="bbfa-dot">.</span></>}
        actions={canWrite ? <Link className="bbfa-btn" href="/admin/forms/new">+ New form</Link> : null}
      />
      <section className="bbfa-band">
        <div><strong>{forms.length}</strong><span>Forms</span></div>
        <div><strong>{active}</strong><span>Active</span></div>
        <div><strong>{(t?.total ?? 0).toLocaleString("en-US")}</strong><span>Total responses</span></div>
        <div><strong>{(t?.last30 ?? 0).toLocaleString("en-US")}<i>+</i></strong><span>Last 30 days</span></div>
        <div><strong>{(t?.unread ?? 0).toLocaleString("en-US")}</strong><span>Unread</span></div>
      </section>
      <section className="bbfa-section">
        <div className="bbfa-section__head">
          <div><div className="bbfa-eyebrow">Library</div><h2>All forms</h2></div>
          <form method="get" className="bbfa-search"><input type="search" name="q" defaultValue={q} placeholder="Search forms..." /></form>
        </div>
        {forms.length ? (
          <FormsTable
            canWrite={canWrite}
            canDelete={can(user.role, "forms.delete")}
            rows={forms.map((f) => ({ id: f.id, title: f.title, status: f.status, slug: f.slug, updatedAt: f.updatedAt.toISOString(), responses: f.responses, unread: f.unread, lastResponse: f.lastResponse?.toISOString() ?? null, views: f.views }))}
          />
        ) : (
          <div className="bbfa-empty">
            <div className="bbfa-empty__icon">B<i>*</i></div>
            <h3>{q ? "No forms match your search." : "Systems always win. Build your first form."}</h3>
            <p>Start from a template or a blank canvas. Embed anywhere on the site.</p>
            {canWrite ? <Link className="bbfa-btn" href="/admin/forms/new">+ Create a form</Link> : null}
          </div>
        )}
      </section>
    </>
  );
}
