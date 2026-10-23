import { revalidatePath } from "next/cache";
import { listActiveCourses, listCategories } from "./courses";
import { allLessonParams, allModuleParams } from "./public-data";

/**
 * Refreshes the cached public School pages. Call (and await) after anything that changes what students and visitors see.
 * Every public address is named literally: a route pattern or a layout call does not reach pages that were prebuilt from
 * generateStaticParams. A catalog is a few hundred pages at most, so refreshing all of them is cheap.
 */
export async function refreshSchool() {
  revalidatePath("/school");
  try {
    const [courses, categories, modules, lessons] = await Promise.all([listActiveCourses(), listCategories(), allModuleParams(), allLessonParams()]);
    for (const c of categories) revalidatePath(`/school/category/${c.slug}`);
    for (const c of courses) revalidatePath(`/school/${c.slug}`);
    for (const m of modules) revalidatePath(`/school/${m.course}/${m.module}`);
    for (const l of lessons) revalidatePath(`/school/${l.course}/${l.module}/${l.lesson}`);
  } catch (error) {
    console.error("[school] refresh failed", error instanceof Error ? error.message : error);
  }
}
