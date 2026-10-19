import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/current";
import { DashboardView } from "@/modules/forms/admin/dashboard";
import { getForm } from "@/modules/forms/lib/forms";
import { getGlobalSettings } from "@/modules/forms/lib/settings-store";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("forms.view");
  const form = await getForm(Number((await params).id));
  if (!form) notFound();
  const g = await getGlobalSettings();
  return <DashboardView formId={form.id} accent={form.settings.accent || g.accent_color} />;
}
