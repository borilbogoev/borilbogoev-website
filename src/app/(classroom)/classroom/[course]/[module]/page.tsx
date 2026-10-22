import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { site } from "@/content/site";
import { Cover } from "@/modules/classroom/components/catalog";
import { ModuleLessons } from "@/modules/classroom/components/player";
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
  const { data, m, index } = f;
  return (
    <article className="cr-article">
      <header className="cr-module-head">
        <p className="cr-eyebrow">
          Module {index + 1} of {data.modules.length}
        </p>
        <h1>
          {m.title.replace(/\.$/, "")}
          <span className="cr-dot">.</span>
        </h1>
        {m.summary ? <p className="cr-sub cr-sub--lg">{m.summary}</p> : null}
        {m.image.url ? <Cover img={m.image} alt="" ratio="21 / 9" priority sizes="(min-width: 1100px) 760px, 100vw" /> : null}
      </header>
      <ModuleLessons moduleSlug={m.slug} />
    </article>
  );
}
