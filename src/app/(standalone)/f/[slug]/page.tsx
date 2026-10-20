import type { Metadata } from "next";
import { allFormSlugs, formMetadata, FormRoute } from "@/modules/forms/components/form-route";

// A form on its own page: /f/<slug> ("f" for forms). See modules/forms/lib/paths.ts.
export const revalidate = 3600;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await allFormSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return formMetadata((await params).slug);
}

export default async function FormPageRoute({ params }: Props) {
  return <FormRoute slug={(await params).slug} />;
}
