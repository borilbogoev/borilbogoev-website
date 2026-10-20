import { notFound } from "next/navigation";
import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { PageTabs, StatusPill } from "@/modules/landing/admin/tabs";
import { CopyCode } from "@/modules/forms/admin/ui";
import { getPage } from "@/modules/landing/lib/pages";
import { PageHeader } from "../../header";

// Header and tabs shared by every screen of one landing page.
export default async function LandingPageLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser("landing.view");
  const page = await getPage(Number(id));
  if (!page) notFound();
  const url = `${site.url}/l/${page.slug}`;
  const tabs = [
    { key: "builder", label: "Build" },
    { key: "settings", label: "Settings" },
    { key: "dashboard", label: "Dashboard" },
  ];
  return (
    <>
      <PageHeader
        eyebrow={`Landing page #${page.id}`}
        title={
          <>
            {page.title} <StatusPill status={page.status} />
          </>
        }
        actions={
          <>
            <CopyCode text={url}>/l/{page.slug}</CopyCode>
            <a className="bbfa-btn bbfa-btn--ghost" target="_blank" rel="noopener noreferrer" href={`/admin/landing/${page.id}/preview`}>
              Preview ↗
            </a>
            {page.status === "published" ? (
              <a className="bbfa-btn bbfa-btn--ghost" target="_blank" rel="noopener noreferrer" href={`/l/${page.slug}`}>
                View live ↗
              </a>
            ) : null}
          </>
        }
      />
      <PageTabs pageId={page.id} tabs={tabs} />
      {children}
    </>
  );
}
