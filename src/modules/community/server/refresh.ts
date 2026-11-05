// Public pages are cached. Call this after anything that changes what a public community shows, so the change is live at once
// instead of at the next 5 minute refresh. Safe anywhere: outside a Next.js request (tests, scripts) it does nothing.
import { revalidatePath } from "next/cache";

export function refreshPublic(post?: { communitySlug: string; postId: number }) {
  try {
    revalidatePath("/l/[slug]", "page"); // any landing page may show a Featured post or a Posts feed
    if (post) revalidatePath(`/c/${post.communitySlug}/${post.postId}`);
  } catch {
    // not inside a request: the timed refresh covers it
  }
}
