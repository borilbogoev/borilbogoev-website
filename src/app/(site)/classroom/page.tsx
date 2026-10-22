import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { Section } from "@/components/ui";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { CategoryCard, CourseCard } from "@/modules/classroom/components/catalog";
import { listActiveCourses, listCategories } from "@/modules/classroom/lib/courses";
import { getSettings } from "@/modules/classroom/lib/settings-store";
import { settingsDefaults } from "@/modules/classroom/lib/settings";

// The Classroom hub. Static and cached; saving a course refreshes it at once (revalidatePath), this time is the safety net.
export const revalidate = 300;

export const metadata = pageMetadata({
  title: "Classroom: courses on AI and automation",
  description: "Courses, modules and lessons on AI, automation and building a business operating system, by Boril Bogoev, Ph.D.",
  path: "/classroom",
});

async function load() {
  try {
    const [settings, categories, courses] = await Promise.all([getSettings(), listCategories(true), listActiveCourses()]);
    return { settings, categories, courses };
  } catch {
    return { settings: settingsDefaults(), categories: [], courses: [] }; // no database at build time: built on first visit
  }
}

export default async function ClassroomPage() {
  const { settings, categories, courses } = await load();
  return (
    <>
      <section className="section hero-soft pb-6 pt-12 md:pb-10 md:pt-20">
        <div className="container-bb">
          <p className="eyebrow">{settings.hub_eyebrow}</p>
          <h1 className="t-display-lg mt-3">
            {settings.hub_title.replace(/\.$/, "")}
            <span className="accent">.</span>
          </h1>
          {settings.hub_intro ? <p className="t-subtitle mt-5 max-w-[52ch]">{settings.hub_intro}</p> : null}
          <p className="mt-6">
            <Link className="cr-textlink" href="/classroom/my">
              My courses
            </Link>
          </p>
        </div>
      </section>
      {categories.length > 1 ? (
        <Section eyebrow="Categories" heading="Pick a topic.">
          <div className="cr-grid-cards">
            {categories.map((c) => (
              <CategoryCard key={c.id} c={c} />
            ))}
          </div>
        </Section>
      ) : null}
      <Section alt={categories.length > 1} eyebrow="Courses" heading={courses.length ? "All courses." : "Courses are on the way."}>
        {courses.length ? (
          <div className="cr-grid-cards">
            {courses.map((c) => (
              <CourseCard key={c.id} c={c} lessons={c.lessons} modules={c.modules} />
            ))}
          </div>
        ) : (
          <p className="t-body-lg">The first course is being prepared. Check back soon.</p>
        )}
      </Section>
      <JsonLd data={breadcrumbLd([{ name: "Classroom", path: "/classroom" }])} />
    </>
  );
}
