// Public addresses of a form's own page.
//   /f/<slug>   every form ("f" for forms; landing pages live under /l/)
//   /s/<slug>   only the two webinar forms that were shared before the Forms module existed. Their links keep working.
export const LEGACY_FORM_SLUGS: ReadonlySet<string> = new Set(["you-and-ai", "webinar-busy-parents-with-ai-bg"]);

export const formPath = (slug: string) => (LEGACY_FORM_SLUGS.has(slug) ? `/s/${slug}` : `/f/${slug}`);
