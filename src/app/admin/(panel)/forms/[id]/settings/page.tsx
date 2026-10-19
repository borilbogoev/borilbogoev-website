import { notFound } from "next/navigation";
import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { FormSettingsEditor } from "@/modules/forms/admin/form-settings";
import { fieldsOf, isEmailField } from "@/modules/forms/lib/blocks";
import { getBlocks, getForm } from "@/modules/forms/lib/forms";
import { getGlobalSettings } from "@/modules/forms/lib/settings-store";

export const metadata = { title: "Form settings" };

export default async function FormSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("forms.view");
  const form = await getForm(Number((await params).id));
  if (!form) notFound();
  const [blocks, g] = await Promise.all([getBlocks(form.id), getGlobalSettings()]);
  const fields = fieldsOf(blocks);
  return (
    <FormSettingsEditor
      formId={form.id}
      title={form.title}
      status={form.status}
      slug={form.slug ?? ""}
      settings={form.settings}
      emailFields={fields.filter(isEmailField).map((f) => ({ key: f.key, label: f.label }))}
      mergeTags={["{form_title}", "{response_id}", "{response_seq}", "{date}", "{site_name}", "{all_fields}", ...fields.map((f) => `{${f.key}}`)]}
      defaults={{ submit: g.label_submit, next: g.label_next, prev: g.label_prev, adminEmail: g.email_admin }}
      siteUrl={site.url}
      readOnly={!can(user.role, "forms.write")}
    />
  );
}
