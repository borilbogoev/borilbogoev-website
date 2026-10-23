import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/current";
import { PlayerShell } from "@/modules/school/components/player";
import { getCourseBySlug, getTree } from "@/modules/school/lib/courses";
import { outlineOf, shellCourse } from "@/modules/school/lib/public-data";
import "@/modules/school/components/school.css";

// The real player for staff: any status, drafts listed, nothing recorded as progress.
export default async function PreviewModuleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ course: string; module: string }> }) {
  await requireUser("school.view");
  const { course: slug, module } = await params;
  const course = await getCourseBySlug(decodeURIComponent(slug));
  const tree = course ? await getTree(course.id, { drafts: true }) : null;
  if (!course || !tree || !tree.modules.some((m) => m.slug === decodeURIComponent(module))) notFound();
  return (
    <PlayerShell course={shellCourse(course, { preview: true })} modules={outlineOf(tree.modules)}>
      {children}
    </PlayerShell>
  );
}
