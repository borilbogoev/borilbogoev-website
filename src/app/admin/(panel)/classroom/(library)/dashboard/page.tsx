import { requireUser } from "@/modules/auth/current";
import { LibraryDashboardView } from "@/modules/classroom/admin/dashboard";
import { ClassroomTabs } from "@/modules/classroom/admin/library-header";
import { PageHeader } from "../../../header";

export const metadata = { title: "Classroom dashboard" };

export default async function ClassroomDashboardPage() {
  const user = await requireUser("classroom.view", "/admin/classroom/dashboard");
  return (
    <>
      <PageHeader
        eyebrow="Classroom"
        title={
          <>
            Dashboard<span className="bbfa-dot">.</span>
          </>
        }
      />
      <ClassroomTabs role={user.role} />
      <LibraryDashboardView />
    </>
  );
}
