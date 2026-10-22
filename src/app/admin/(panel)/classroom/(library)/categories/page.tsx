import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { CategoriesEditor } from "@/modules/classroom/admin/categories-editor";
import { ClassroomTabs } from "@/modules/classroom/admin/library-header";
import { listCategories } from "@/modules/classroom/lib/courses";
import { PageHeader } from "../../../header";

export const metadata = { title: "Classroom categories" };

export default async function CategoriesPage() {
  const user = await requireUser("classroom.view", "/admin/classroom/categories");
  const categories = await listCategories();
  return (
    <>
      <PageHeader
        eyebrow="Classroom"
        title={
          <>
            Categories<span className="bbfa-dot">.</span>
          </>
        }
      />
      <ClassroomTabs role={user.role} />
      <p className="bbfa-muted" style={{ maxWidth: 620 }}>
        A category groups courses on the Classroom page. Each has an image, a name and a short description, and its own page at /classroom/category/&lt;name&gt;. A category appears there once it has an active course.
      </p>
      <CategoriesEditor categories={categories} canWrite={can(user.role, "classroom.write")} canDelete={can(user.role, "classroom.delete")} />
    </>
  );
}
