import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/current";
import { LessonArticle } from "@/modules/classroom/components/articles";
import { getCourseBySlug, getTree } from "@/modules/classroom/lib/courses";

export const metadata = { title: "Preview", robots: { index: false, follow: false } };

export default async function PreviewLesson({ params }: { params: Promise<{ course: string; module: string; lesson: string }> }) {
  await requireUser("classroom.view");
  const { course: slug, module, lesson } = await params;
  const course = await getCourseBySlug(decodeURIComponent(slug));
  const tree = course ? await getTree(course.id, { drafts: true }) : null;
  const m = tree?.modules.find((x) => x.slug === decodeURIComponent(module));
  const l = m?.lessons.find((x) => x.slug === decodeURIComponent(lesson));
  if (!m || !l) notFound();
  return <LessonArticle moduleTitle={m.title} lesson={l} />;
}
