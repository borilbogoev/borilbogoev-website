import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { site } from "@/content/site";
import { FormPage } from "@/modules/forms/components/form-embed";
import { getForm, getFormBySlug } from "@/modules/forms/lib/forms";
import { getGlobalSettings } from "@/modules/forms/lib/settings-store";
import { db } from "@/db/use";
import { schema } from "@/db";
import { isNotNull } from "drizzle-orm";

// A form on its own page: /s/<slug>. The page itself is static; the form loads fresh from /api/forms/<id>/definition,
// so opening, closing and scheduling a form never needs a deploy. The title and address refresh when the form is saved.
export const revalidate = 3600;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  try {
    const rows = await db().select({ slug: schema.bbformsForms.slug }).from(schema.bbformsForms).where(isNotNull(schema.bbformsForms.slug));
    return rows.flatMap((r) => (r.slug ? [{ slug: r.slug }] : []));
  } catch {
    return []; // no database at build time: pages are built on first visit
  }
}

async function load(slug: string) {
  const form = await getFormBySlug(decodeURIComponent(slug));
  return form && form.status !== "draft" ? form : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const form = await load(slug);
  if (!form) return { title: "Form not found" };
  const title = form.settings.page_title || form.title;
  return { title, alternates: { canonical: `${site.url}/s/${form.slug}` }, openGraph: { title: `${title} | ${site.name}`, url: `${site.url}/s/${form.slug}`, siteName: site.name } };
}

export default async function FormPageRoute({ params }: Props) {
  const { slug } = await params;
  const form = await load(slug);
  if (!form) notFound();
  const fresh = await getForm(form.id);
  const g = await getGlobalSettings();
  const theme = (fresh?.settings.theme || g.default_theme) === "dark" ? "dark" : "light";
  return <FormPage id={form.id} theme={theme} />;
}
