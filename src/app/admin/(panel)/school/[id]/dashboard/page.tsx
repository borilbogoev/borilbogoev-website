import { requireUser } from "@/modules/auth/current";
import { CourseDashboardView } from "@/modules/school/admin/dashboard";

export const metadata = { title: "Course analytics" };

export default async function CourseDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("school.view");
  return <CourseDashboardView courseId={Number((await params).id)} />;
}
