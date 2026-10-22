/**
 * Whether the Classroom is announced: in the main menu, the footer and the sitemap, and open to search engines.
 * Off by default: the pages work and can be shared by link, but nothing on the site points to them and they carry noindex.
 * Set CLASSROOM_LISTED=true in Vercel (Production) and redeploy to make the Classroom public.
 */
export const CLASSROOM_LISTED = process.env.CLASSROOM_LISTED === "true";
