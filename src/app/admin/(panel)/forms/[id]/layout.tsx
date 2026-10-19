import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { StatusPill } from "@/modules/forms/admin/forms-table";
import { FormTabs } from "@/modules/forms/admin/tabs";
import { CopyCode } from "@/modules/forms/admin/ui";
import { getForm } from "@/modules/forms/lib/forms";
import { countResponses } from "@/modules/forms/lib/responses";
import { PageHeader } from "../../header";

// Header and tabs shared by every screen of one form.
export default async function FormLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("forms.view");
  const form = await getForm(Number(id));
  if (!form) notFound();
  const count = await countResponses(form.id);
  const tabs = [
    { key: "builder", label: "Build" },
    { key: "settings", label: "Settings" },
    ...(can(user.role, "forms.view") ? [{ key: "responses", label: "Responses" }, { key: "dashboard", label: "Dashboard" }] : []),
    { key: "share", label: "Share" },
  ];
  const snippet = `<FormEmbed id={${form.id}} />`;
  return (
    <>
      <PageHeader
        eyebrow={`Form #${form.id}`}
        title={
          <>
            {form.title} <StatusPill status={form.status} />
          </>
        }
        actions={
          <>
            <CopyCode text={snippet} />
            <a className="bbfa-btn bbfa-btn--ghost" target="_blank" rel="noopener noreferrer" href={`/admin/forms/${form.id}/preview`}>
              Preview ↗
            </a>
          </>
        }
      />
      <FormTabs formId={form.id} count={count} tabs={tabs} />
      {children}
    </>
  );
}
