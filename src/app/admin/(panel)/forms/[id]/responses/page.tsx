import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { Responses, type FieldInfo } from "@/modules/forms/admin/responses";
import { BLOCK_TYPES, fieldOptions, fieldsOf } from "@/modules/forms/lib/blocks";
import { getBlocks, getForm } from "@/modules/forms/lib/forms";

export const metadata = { title: "Responses" };

export default async function ResponsesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ open?: string }> }) {
  const user = await requireUser("forms.view");
  const form = await getForm(Number((await params).id));
  if (!form) notFound();
  const { open } = await searchParams;
  const fields: FieldInfo[] = fieldsOf(await getBlocks(form.id)).map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type,
    subtype: f.subtype,
    numeric: f.type !== "contact" && !!BLOCK_TYPES[f.type].numeric,
    options: fieldOptions(f),
    multiple: f.type === "choice" && !!f.block.settings.multiple,
  }));
  return <Responses formId={form.id} fields={fields} canWrite={can(user.role, "responses.write")} canDelete={can(user.role, "responses.delete")} canExport={can(user.role, "responses.export")} openId={Number(open) || 0} />;
}
