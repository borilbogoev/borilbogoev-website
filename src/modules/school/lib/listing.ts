/**
 * Whether the School is announced: in the main menu, the footer and the sitemap, and open to search engines.
 * On by default. Set SCHOOL_LISTED=false in Vercel (Production) and redeploy to make it share-only again
 * (no menu, footer or sitemap link, noindex). CLASSROOM_LISTED=false, the old name, works too.
 */
export const SCHOOL_LISTED = process.env.SCHOOL_LISTED !== "false" && process.env.CLASSROOM_LISTED !== "false";
