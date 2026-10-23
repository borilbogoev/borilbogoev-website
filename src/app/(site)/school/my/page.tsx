import { pageMetadata } from "@/lib/seo";
import { MyCourses } from "@/modules/school/components/my-courses";

export const metadata = { ...pageMetadata({ title: "My courses", description: "Your courses in the School.", path: "/school/my" }), robots: { index: false, follow: false } };

export default function MyCoursesPage() {
  return (
    <>
      <section className="section hero-soft pb-6 pt-12 md:pb-10 md:pt-20">
        <div className="container-bb">
          <p className="eyebrow">School</p>
          <h1 className="t-display-lg mt-3">
            My courses<span className="accent">.</span>
          </h1>
        </div>
      </section>
      <section className="section">
        <div className="container-bb">
          <MyCourses />
        </div>
      </section>
    </>
  );
}
