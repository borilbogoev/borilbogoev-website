import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { site } from "@/content/site";
import { ModuleArticle } from "@/modules/classroom/components/articles";
import { allModuleParams, loadPublicCourse } from "@/modules/classroom/lib/public-data";

export const revalidate = 300;
export const dynamicParams = true;

type Props = { params: Promise<{ course: string; module: string }> };

export async function generateStaticParams() {
  return allModuleParams();
}

async function find(p: Props["params"]) {
  const { course, module } = await p;
  const data = await loadPublicCourse(course);
  const m = data?.modules.find((x) => x.slug === decodeURIComponent(module));
  return data && m ? { data, m, index: data.modules.indexOf(m) } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const f = await find(params);
  if (!f) return { title: "Not found", robots: { index: false, follow: false } };
  return { title: { absolute: `${f.m.title} | ${f.data.course.title} | ${site.name}` }, description: f.m.summary || undefined, robots: { index: false, follow: true } };
}

export default async function ModulePage({ params }: Props) {
  const f = await find(params);
  if (!f) notFound();
  return <ModuleArticle module={f.m} index={f.index} total={f.data.modules.length} />;
}
