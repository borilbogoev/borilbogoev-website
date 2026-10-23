import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/current";
import { getCourseBySlug, getTree } from "@/modules/school/lib/courses";

// Staff preview of a course: opens its first lesson, drafts included.
export default async function PreviewCourse({ params }: { params: Promise<{ course: string }> }) {
  await requireUser("school.view");
  const course = await getCourseBySlug(decodeURIComponent((await params).course));
  if (!course) notFound();
  const tree = await getTree(course.id, { drafts: true });
  const m = tree?.modules.find((x) => x.lessons.length) ?? tree?.modules[0];
  if (!m) redirect(`/admin/school/${course.id}/builder`);
  const l = m.lessons[0];
  redirect(`/admin/preview/school/${course.slug}/${m.slug}${l ? `/${l.slug}` : ""}`);
}
