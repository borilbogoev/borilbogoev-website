import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { db } from "@/db/use";
import { JsonLd } from "@/components/json-ld";
import { Section } from "@/components/ui";
import { site } from "@/content/site";
import { abs, breadcrumbLd, indexable } from "@/lib/seo";
import { Cover, languageName } from "@/modules/classroom/components/catalog";
import { CourseAction } from "@/modules/classroom/components/course-action";
import { formatPrice, LEVELS } from "@/modules/classroom/lib/course-settings";
import { getTree, listCategories } from "@/modules/classroom/lib/courses";
import { shellCourse } from "@/modules/classroom/lib/public-data";
import { getCourseBySlug } from "@/modules/classroom/lib/courses";

// A course at /classroom/<slug>. Static and cached like the rest of the site; saving a course refreshes it at once.
export const revalidate = 300;
export const dynamicParams = true;

type Props = { params: Promise<{ course: string }> };

const load = cache(async (slug: string) => {
  const course = await getCourseBySlug(decodeURIComponent(slug));
  if (!course) return null;
  const [tree, categories] = await Promise.all([getTree(course.id), listCategories()]);
  return tree ? { course, modules: tree.modules, category: categories.find((c) => c.id === course.categoryId) ?? null } : null;
});

export async function generateStaticParams() {
  try {
    const rows = await db().select({ slug: schema.classroomCourses.slug }).from(schema.classroomCourses).where(eq(schema.classroomCourses.status, "active"));
    return rows.map((r) => ({ course: r.slug }));
  } catch {
    return []; // no database at build time: courses are built on first visit
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load((await params).course);
  if (!data || data.course.status !== "active") return { title: "Not found", robots: { index: false, follow: false } };
  const { course } = data;
  const s = course.settings;
  const title = s.seo_title || course.title;
  const description = s.seo_description || course.summary || undefined;
  const url = abs(`/classroom/${course.slug}`);
  const image = s.og_image?.url || course.image.url;
  return {
    title: { absolute: `${title} | ${site.name}` },
    description,
    alternates: { canonical: url },
    robots: s.indexable && indexable ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } } : { index: false, follow: false },
    openGraph: { type: "website", url, title, description, siteName: site.name, images: image ? [{ url: image }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function CoursePage({ params }: Props) {
  const data = await load((await params).course);
  if (!data) notFound();
  const { course, modules, category } = data;
  if (course.status !== "active") notFound();

  const s = course.settings;
  const lessonHrefs: Record<number, string> = {};
  for (const m of modules) for (const l of m.lessons) lessonHrefs[l.id] = `/classroom/${course.slug}/${m.slug}/${l.slug}`;
  const firstHref = Object.values(lessonHrefs)[0] ?? `/classroom/${course.slug}`;
  const lessonCount = Object.keys(lessonHrefs).length;
  const priceLabel = formatPrice(course.access === "paid" ? course.priceCents : 0, course.currency);
  const url = abs(`/classroom/${course.slug}`);

  return (
    <>
      <section className="section hero-soft pb-8 pt-12 md:pb-12 md:pt-20">
        <div className="container-bb cr-hero">
          <div>
            <p className="eyebrow">{category ? category.name : "Course"}</p>
            <h1 className="t-display-lg mt-3">
              {course.title.replace(/\.$/, "")}
              <span className="accent">.</span>
            </h1>
            {course.summary ? <p className="t-subtitle mt-5 max-w-[52ch]">{course.summary}</p> : null}
            <ul className="cr-facts">
              {s.level ? <li>{LEVELS[s.level]}</li> : null}
              <li>
                {modules.length} {modules.length === 1 ? "module" : "modules"}
              </li>
              <li>
                {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
              </li>
              {s.duration ? <li>{s.duration}</li> : null}
              <li>{languageName(course.language)}</li>
              <li>{course.access === "invite" ? "By invitation" : priceLabel}</li>
            </ul>
            <CourseAction course={shellCourse(course)} firstHref={firstHref} lessonHrefs={lessonHrefs} total={lessonCount} />
          </div>
          <div className="cr-hero__media">
            <Cover img={course.image} alt="" priority sizes="(min-width: 1024px) 460px, 100vw" />
          </div>
        </div>
      </section>

      {s.outcomes.length ? (
        <Section eyebrow="Outcomes" heading="What you will learn.">
          <ul className="cr-outcomes">
            {s.outcomes.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section alt={!!s.outcomes.length} eyebrow="Curriculum" heading={modules.length ? "Modules." : "The curriculum is on the way."}>
        <ol className="cr-modules">
          {modules.map((m, i) => (
            <li key={m.id}>
              <Link href={`/classroom/${course.slug}/${m.slug}`} className="card cr-module">
                <Cover img={m.image} alt="" ratio="4 / 3" sizes="(min-width: 768px) 220px, 100vw" />
                <div className="cr-module__body">
                  <p className="cr-meta">Module {i + 1}</p>
                  <h3 className="t-h3">{m.title}</h3>
                  {m.summary ? <p className="t-body-sm">{m.summary}</p> : null}
                  <p className="cr-meta">
                    {m.lessons.length} {m.lessons.length === 1 ? "lesson" : "lessons"}
                    {m.lessons.reduce((n, l) => n + l.minutes, 0) ? ` · ${m.lessons.reduce((n, l) => n + l.minutes, 0)} min` : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </Section>

      {s.instructor ? (
        <Section eyebrow="Instructor" heading={s.instructor}>
          {s.instructor_role ? <p className="t-body-lg">{s.instructor_role}</p> : null}
        </Section>
      ) : null}

      <JsonLd
        data={[
          breadcrumbLd([{ name: "Classroom", path: "/classroom" }, ...(category ? [{ name: category.name, path: `/classroom/category/${category.slug}` }] : []), { name: course.title, path: `/classroom/${course.slug}` }]),
          {
            "@context": "https://schema.org",
            "@type": "Course",
            "@id": `${url}#course`,
            url,
            name: course.title,
            description: s.seo_description || course.summary || undefined,
            inLanguage: course.language,
            provider: { "@id": `${site.url}/#person` },
            ...(course.access === "paid" ? { offers: { "@type": "Offer", price: (course.priceCents / 100).toFixed(2), priceCurrency: course.currency, category: "Paid" } } : {}),
            ...(course.access === "open" ? { offers: { "@type": "Offer", price: "0", priceCurrency: course.currency, category: "Free" } } : {}),
            hasCourseInstance: { "@type": "CourseInstance", courseMode: "Online", courseWorkload: s.duration || undefined },
          },
        ]}
      />
    </>
  );
}
