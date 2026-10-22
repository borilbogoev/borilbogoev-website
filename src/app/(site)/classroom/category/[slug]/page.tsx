import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { JsonLd } from "@/components/json-ld";
import { Section } from "@/components/ui";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { CourseCard, Cover } from "@/modules/classroom/components/catalog";
import { CLASSROOM_LISTED } from "@/modules/classroom/lib/listing";
import { getCategoryBySlug, listActiveCourses, listCategories } from "@/modules/classroom/lib/courses";

export const revalidate = 300;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

const load = cache((slug: string) => getCategoryBySlug(decodeURIComponent(slug)));

export async function generateStaticParams() {
  try {
    return (await listCategories(true)).map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await load((await params).slug);
  if (!c) return { title: "Not found", robots: { index: false, follow: false } };
  return { ...pageMetadata({ title: `${c.name} courses`, description: c.summary || `Courses in ${c.name} by Boril Bogoev, Ph.D.`, path: `/classroom/category/${c.slug}` }), ...(CLASSROOM_LISTED ? {} : { robots: { index: false, follow: false } }) };
}

export default async function CategoryPage({ params }: Props) {
  const c = await load((await params).slug);
  if (!c) notFound();
  const courses = await listActiveCourses(c.id);
  return (
    <>
      <section className="section hero-soft pb-6 pt-12 md:pb-10 md:pt-20">
        <div className="container-bb cr-hero">
          <div>
            <p className="eyebrow">Category</p>
            <h1 className="t-display-lg mt-3">
              {c.name}
              <span className="accent">.</span>
            </h1>
            {c.summary ? <p className="t-subtitle mt-5 max-w-[52ch]">{c.summary}</p> : null}
          </div>
          {c.image.url ? (
            <div className="cr-hero__media">
              <Cover img={c.image} alt="" priority sizes="(min-width: 1024px) 420px, 100vw" />
            </div>
          ) : null}
        </div>
      </section>
      <Section eyebrow="Courses" heading={courses.length ? `In ${c.name}.` : "No courses here yet."}>
        <div className="cr-grid-cards">
          {courses.map((k) => (
            <CourseCard key={k.id} c={k} lessons={k.lessons} modules={k.modules} />
          ))}
        </div>
      </Section>
      <JsonLd data={breadcrumbLd([{ name: "Classroom", path: "/classroom" }, { name: c.name, path: `/classroom/category/${c.slug}` }])} />
    </>
  );
}
