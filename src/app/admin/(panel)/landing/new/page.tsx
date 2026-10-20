import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { NewPageEditor } from "@/modules/landing/admin/new-page";
import { TEMPLATES } from "@/modules/landing/lib/templates";
import { PageHeader } from "../../header";

export const metadata = { title: "New landing page" };

export default async function NewLandingPage() {
  await requireUser("landing.write", "/admin/landing/new");
  const templates = Object.entries(TEMPLATES).map(([key, t]) => ({ key, label: t.label, desc: t.desc, blocks: t.blocks.length }));
  return (
    <>
      <PageHeader eyebrow="New landing page" title={<>Start building<span className="bbfa-dot">.</span></>} />
      <NewPageEditor templates={templates} siteUrl={site.url} />
    </>
  );
}
