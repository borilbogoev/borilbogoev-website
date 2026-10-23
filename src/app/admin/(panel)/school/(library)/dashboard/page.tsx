import { requireUser } from "@/modules/auth/current";
import { LibraryDashboardView } from "@/modules/school/admin/dashboard";
import { SchoolTabs } from "@/modules/school/admin/library-header";
import { PageHeader } from "../../../header";

export const metadata = { title: "School dashboard" };

export default async function SchoolDashboardPage() {
  const user = await requireUser("school.view", "/admin/school/dashboard");
  return (
    <>
      <PageHeader
        eyebrow="School"
        title={
          <>
            Dashboard<span className="bbfa-dot">.</span>
          </>
        }
      />
      <SchoolTabs role={user.role} />
      <LibraryDashboardView />
    </>
  );
}
