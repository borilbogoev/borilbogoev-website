import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { CategoriesEditor } from "@/modules/school/admin/categories-editor";
import { SchoolTabs } from "@/modules/school/admin/library-header";
import { listCategories } from "@/modules/school/lib/courses";
import { PageHeader } from "../../../header";

export const metadata = { title: "School categories" };

export default async function CategoriesPage() {
  const user = await requireUser("school.view", "/admin/school/categories");
  const categories = await listCategories();
  return (
    <>
      <PageHeader
        eyebrow="School"
        title={
          <>
            Categories<span className="bbfa-dot">.</span>
          </>
        }
      />
      <SchoolTabs role={user.role} />
      <p className="bbfa-muted" style={{ maxWidth: 620 }}>
        A category groups courses on the School page. Each has an image, a name and a short description, and its own page at /school/category/&lt;name&gt;. A category appears there once it has an active course.
      </p>
      <CategoriesEditor categories={categories} canWrite={can(user.role, "school.write")} canDelete={can(user.role, "school.delete")} />
    </>
  );
}
