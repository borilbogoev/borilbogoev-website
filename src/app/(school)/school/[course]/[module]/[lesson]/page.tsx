import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { site } from "@/content/site";
import { LessonArticle } from "@/modules/school/components/articles";
import { allLessonParams, loadPublicCourse } from "@/modules/school/lib/public-data";

// A lesson. The page is static and holds only what is public (title, summary, picture); the lesson content itself is fetched
// after sign-in and an access check, so a paid lesson is never in the HTML anyone can download.
export const revalidate = 300;
export const dynamicParams = true;

type Props = { params: Promise<{ course: string; module: string; lesson: string }> };

export async function generateStaticParams() {
  return allLessonParams();
}

async function find(p: Props["params"]) {
  const { course, module, lesson } = await p;
  const data = await loadPublicCourse(course);
  const m = data?.modules.find((x) => x.slug === decodeURIComponent(module));
  const l = m?.lessons.find((x) => x.slug === decodeURIComponent(lesson));
  return data && m && l ? { data, m, l } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const f = await find(params);
  if (!f) return { title: "Not found", robots: { index: false, follow: false } };
  return { title: { absolute: `${f.l.title} | ${f.data.course.title} | ${site.name}` }, description: f.l.summary || undefined, robots: { index: false, follow: true } };
}

export default async function LessonPage({ params }: Props) {
  const f = await find(params);
  if (!f) notFound();
  return <LessonArticle moduleTitle={f.m.title} lesson={f.l} />;
}
