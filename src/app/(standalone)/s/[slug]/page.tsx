import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { allFormSlugs, formMetadata, FormRoute } from "@/modules/forms/components/form-route";
import { LEGACY_FORM_SLUGS } from "@/modules/forms/lib/paths";

// Only the two webinar forms that were shared before the Forms module live at /s/<slug> and keep working there.
// Any other form belongs at /f/<slug>, so an address typed with /s/ is sent there.
export const revalidate = 3600;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await allFormSlugs()).filter((s) => LEGACY_FORM_SLUGS.has(s)).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return LEGACY_FORM_SLUGS.has(decodeURIComponent(slug)) ? formMetadata(slug) : { title: "Form not found" };
}

export default async function LegacyFormPageRoute({ params }: Props) {
  const slug = decodeURIComponent((await params).slug);
  if (!LEGACY_FORM_SLUGS.has(slug)) {
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound();
    permanentRedirect(`/f/${slug}`);
  }
  return <FormRoute slug={slug} />;
}
