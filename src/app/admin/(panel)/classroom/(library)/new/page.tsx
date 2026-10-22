import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { ClassroomTabs } from "@/modules/classroom/admin/library-header";
import { NewCourseEditor } from "@/modules/classroom/admin/new-course";
import { listCategories } from "@/modules/classroom/lib/courses";
import { PageHeader } from "../../../header";

export const metadata = { title: "New course" };

export default async function NewCoursePage() {
  const user = await requireUser("classroom.write", "/admin/classroom/new");
  const categories = await listCategories();
  return (
    <>
      <PageHeader
        eyebrow="Classroom"
        title={
          <>
            New course<span className="bbfa-dot">.</span>
          </>
        }
      />
      <ClassroomTabs role={user.role} />
      <NewCourseEditor siteUrl={site.url} categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
    </>
  );
}
