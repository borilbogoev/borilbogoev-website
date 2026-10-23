import { notFound } from "next/navigation";
import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { CourseSettingsEditor } from "@/modules/school/admin/course-settings-editor";
import { listCategories, getCourse } from "@/modules/school/lib/courses";
import { CURRENCIES } from "@/modules/school/lib/settings";

export const metadata = { title: "Course settings" };

export default async function CourseSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("school.view");
  const course = await getCourse(Number((await params).id));
  if (!course) notFound();
  const categories = await listCategories();
  return (
    <CourseSettingsEditor
      courseId={course.id}
      title={course.title}
      status={course.status}
      slug={course.slug}
      categoryId={course.categoryId}
      summary={course.summary}
      image={course.image}
      language={course.language}
      access={course.access}
      price={course.priceCents / 100}
      currency={course.currency}
      settings={course.settings}
      siteUrl={site.url}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      currencies={CURRENCIES}
      readOnly={!can(user.role, "school.write")}
    />
  );
}
