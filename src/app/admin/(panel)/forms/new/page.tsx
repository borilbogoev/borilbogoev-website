import { requireUser } from "@/modules/auth/current";
import { NewFormEditor } from "@/modules/forms/admin/new-form";
import { TEMPLATES } from "@/modules/forms/lib/forms";
import { PageHeader } from "../../header";

export const metadata = { title: "New form" };

export default async function NewFormPage() {
  await requireUser("forms.write", "/admin/forms/new");
  const templates = Object.entries(TEMPLATES).map(([key, t]) => ({ key, label: t.label, desc: t.desc, blocks: t.blocks.length }));
  return (
    <>
      <PageHeader eyebrow="New form" title={<>Start building<span className="bbfa-dot">.</span></>} />
      <NewFormEditor templates={templates} />
    </>
  );
}
