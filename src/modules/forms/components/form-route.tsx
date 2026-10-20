import { isNotNull } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { schema } from "@/db";
import { db } from "@/db/use";
import { site } from "@/content/site";
import { getForm, getFormBySlug } from "../lib/forms";
import { formPath } from "../lib/paths";
import { getGlobalSettings } from "../lib/settings-store";
import { FormPage } from "./form-embed";

// A form on its own page. The page itself is static; the form loads fresh from /api/forms/<id>/definition,
// so opening, closing and scheduling a form never needs a deploy. The title and address refresh when the form is saved.

export async function allFormSlugs(): Promise<string[]> {
  try {
    const rows = await db().select({ slug: schema.bbformsForms.slug }).from(schema.bbformsForms).where(isNotNull(schema.bbformsForms.slug));
    return rows.flatMap((r) => (r.slug ? [r.slug] : []));
  } catch {
    return []; // no database at build time: pages are built on first visit
  }
}

export async function loadFormBySlug(slug: string) {
  const form = await getFormBySlug(decodeURIComponent(slug));
  return form && form.status !== "draft" ? form : null;
}

export async function formMetadata(slug: string): Promise<Metadata> {
  const form = await loadFormBySlug(slug);
  if (!form || !form.slug) return { title: "Form not found" };
  const title = form.settings.page_title || form.title;
  const url = `${site.url}${formPath(form.slug)}`;
  return { title, alternates: { canonical: url }, openGraph: { title: `${title} | ${site.name}`, url, siteName: site.name } };
}

export async function FormRoute({ slug }: { slug: string }) {
  const form = await loadFormBySlug(slug);
  if (!form) notFound();
  const fresh = await getForm(form.id);
  const g = await getGlobalSettings();
  const theme = (fresh?.settings.theme || g.default_theme) === "dark" ? "dark" : "light";
  return <FormPage id={form.id} theme={theme} />;
}
