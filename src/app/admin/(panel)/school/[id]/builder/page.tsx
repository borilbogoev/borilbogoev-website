import { notFound } from "next/navigation";
import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { CourseBuilder } from "@/modules/school/admin/builder";
import { getTree } from "@/modules/school/lib/courses";

export const metadata = { title: "Build course" };

export default async function BuildCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("school.view");
  const tree = await getTree(Number((await params).id), { drafts: true });
  if (!tree) notFound();
  const modules = tree.modules.map((m) => ({
    id: m.id,
    title: m.title,
    slug: m.slug,
    summary: m.summary,
    image: m.image,
    lessons: m.lessons.map((l) => ({ id: l.id, moduleId: l.moduleId, title: l.title, slug: l.slug, summary: l.summary, status: l.status, preview: l.preview, minutes: l.minutes, image: l.image })),
  }));
  return (
    <CourseBuilder
      courseId={tree.course.id}
      courseSlug={tree.course.slug}
      courseStatus={tree.course.status}
      siteUrl={site.url}
      initialModules={modules}
      initialLessonId={modules.flatMap((m) => m.lessons)[0]?.id ?? null}
      canWrite={can(user.role, "school.write")}
      canDelete={can(user.role, "school.delete")}
    />
  );
}
