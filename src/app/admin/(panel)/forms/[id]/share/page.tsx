import { notFound } from "next/navigation";
import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { SharePanel } from "@/modules/forms/admin/share";
import { getForm } from "@/modules/forms/lib/forms";
import { pagesUsingForm } from "@/modules/landing/lib/pages";

export const metadata = { title: "Share" };

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("forms.view");
  const form = await getForm(Number((await params).id));
  if (!form) notFound();
  const landing = await pagesUsingForm(form.id).catch(() => []);
  return <SharePanel formId={form.id} slug={form.slug ?? ""} siteUrl={site.url} landingPages={landing} />;
}
