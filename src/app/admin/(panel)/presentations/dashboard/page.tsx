import { requireUser } from "@/modules/auth/current";
import { LibraryDashboardView } from "@/modules/presentations/admin/dashboard";
import { LibraryTabs } from "@/modules/presentations/admin/tabs";
import { libraryDashboard } from "@/modules/presentations/lib/stats";
import { PageHeader } from "../../header";

export const metadata = { title: "Presentations dashboard" };

export default async function PresentationsDashboardPage() {
  await requireUser("presentations.view", "/admin/presentations/dashboard");
  const data = await libraryDashboard();
  return (
    <>
      <PageHeader
        eyebrow="Presentations"
        title={
          <>
            Dashboard<span className="bbfa-dot">.</span>
          </>
        }
      />
      <LibraryTabs />
      <LibraryDashboardView d={data} />
    </>
  );
}
