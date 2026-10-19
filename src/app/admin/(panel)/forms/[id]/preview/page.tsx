import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/current";
import { FormPage } from "@/modules/forms/components/form-embed";
import { getForm } from "@/modules/forms/lib/forms";
import { getGlobalSettings } from "@/modules/forms/lib/settings-store";

export const metadata = { title: "Preview" };

// The form exactly as visitors see it. Drafts are visible here because the viewer is signed in.
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("forms.view");
  const form = await getForm(Number((await params).id));
  if (!form) notFound();
  const g = await getGlobalSettings();
  return (
    <div style={{ margin: "0 -32px" }}>
      <FormPage id={form.id} theme={(form.settings.theme || g.default_theme) === "dark" ? "dark" : "light"} />
    </div>
  );
}
