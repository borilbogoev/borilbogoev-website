import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/current";
import { ModuleArticle } from "@/modules/classroom/components/articles";
import { getCourseBySlug, getTree } from "@/modules/classroom/lib/courses";

export const metadata = { title: "Preview", robots: { index: false, follow: false } };

export default async function PreviewModule({ params }: { params: Promise<{ course: string; module: string }> }) {
  await requireUser("classroom.view");
  const { course: slug, module } = await params;
  const course = await getCourseBySlug(decodeURIComponent(slug));
  const tree = course ? await getTree(course.id, { drafts: true }) : null;
  const m = tree?.modules.find((x) => x.slug === decodeURIComponent(module));
  if (!tree || !m) notFound();
  return <ModuleArticle module={m} index={tree.modules.indexOf(m)} total={tree.modules.length} />;
}
