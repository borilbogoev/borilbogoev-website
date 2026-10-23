import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { SchoolTabs } from "@/modules/school/admin/library-header";
import { NewCourseEditor } from "@/modules/school/admin/new-course";
import { listCategories } from "@/modules/school/lib/courses";
import { PageHeader } from "../../../header";

export const metadata = { title: "New course" };

export default async function NewCoursePage() {
  const user = await requireUser("school.write", "/admin/school/new");
  const categories = await listCategories();
  return (
    <>
      <PageHeader
        eyebrow="School"
        title={
          <>
            New course<span className="bbfa-dot">.</span>
          </>
        }
      />
      <SchoolTabs role={user.role} />
      <NewCourseEditor siteUrl={site.url} categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
    </>
  );
}
