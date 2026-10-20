import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { NewDeckEditor } from "@/modules/presentations/admin/new-deck";
import { listCategories } from "@/modules/presentations/lib/presentations";
import { DECK_TEMPLATES } from "@/modules/presentations/lib/templates";
import { PageHeader } from "../../header";

export const metadata = { title: "New presentation" };

export default async function NewPresentationPage() {
  await requireUser("presentations.write", "/admin/presentations/new");
  const templates = Object.entries(DECK_TEMPLATES).map(([key, t]) => ({ key, label: t.label, desc: t.desc, slides: t.slides.length, mode: t.mode ?? "slides", orientation: t.orientation ?? "landscape" }));
  const categories = (await listCategories()).map((c) => ({ id: c.id, name: c.name }));
  return (
    <>
      <PageHeader eyebrow="New presentation" title={<>Start building<span className="bbfa-dot">.</span></>} />
      <NewDeckEditor templates={templates} siteUrl={site.url} categories={categories} />
    </>
  );
}
