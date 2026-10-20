import { revalidatePath } from "next/cache";

/** Refreshes the cached public pages. Call after anything that changes what /l/<slug> shows. */
export function refreshPages(...slugs: (string | null | undefined)[]) {
  for (const slug of new Set(slugs)) if (slug) revalidatePath(`/l/${slug}`);
}
