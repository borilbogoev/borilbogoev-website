import { revalidatePath } from "next/cache";

/** Refreshes the cached public decks. Call after anything that changes what /p/<slug> shows. */
export function refreshDecks(...slugs: (string | null | undefined)[]) {
  for (const slug of new Set(slugs)) if (slug) revalidatePath(`/p/${slug}`);
}
