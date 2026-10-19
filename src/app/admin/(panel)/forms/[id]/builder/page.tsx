import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { Builder } from "@/modules/forms/admin/builder";
import { getBlocks, getForm } from "@/modules/forms/lib/forms";
import { getGlobalSettings } from "@/modules/forms/lib/settings-store";

export const metadata = { title: "Build" };

export default async function BuildPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("forms.view");
  const form = await getForm(Number((await params).id));
  if (!form) notFound();
  const [blocks, g] = await Promise.all([getBlocks(form.id), getGlobalSettings()]);
  return <Builder formId={form.id} initialTitle={form.title} initialStatus={form.status} initialBlocks={blocks} accent={form.settings.accent || g.accent_color} canSave={can(user.role, "forms.write")} />;
}
