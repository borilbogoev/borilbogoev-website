import { revalidatePath } from "next/cache";
import { listActiveCourses, listCategories } from "@/modules/school/lib/courses";

const PAGES = ["/", "/about", "/contact", "/sessions", "/screening", "/sprint", "/shift", "/subscription", "/school", "/school/sign-in", "/school/my"];

/** The header sits on every public page with the site frame: refresh them all after the menu changes. */
export async function refreshMenu() {
  revalidatePath("/", "layout");
  for (const p of PAGES) revalidatePath(p);
  try {
    const [courses, categories] = await Promise.all([listActiveCourses(), listCategories()]);
    for (const c of categories) revalidatePath(`/school/category/${c.slug}`);
    for (const c of courses) revalidatePath(`/school/${c.slug}`);
  } catch (error) {
    console.error("[menu] refresh failed", error instanceof Error ? error.message : error);
  }
}
