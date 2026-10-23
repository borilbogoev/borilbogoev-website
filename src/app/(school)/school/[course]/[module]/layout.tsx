import { notFound } from "next/navigation";
import { PlayerShell } from "@/modules/school/components/player";
import { allModuleParams, loadPublicCourse, outlineOf, shellCourse } from "@/modules/school/lib/public-data";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  return allModuleParams();
}

export default async function ModuleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ course: string; module: string }> }) {
  const { course: slug, module } = await params;
  const data = await loadPublicCourse(slug);
  if (!data || !data.modules.some((m) => m.slug === decodeURIComponent(module))) notFound();
  return (
    <PlayerShell course={shellCourse(data.course)} modules={outlineOf(data.modules)}>
      {children}
    </PlayerShell>
  );
}
