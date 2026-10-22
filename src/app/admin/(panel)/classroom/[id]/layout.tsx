import { notFound } from "next/navigation";
import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { CopyCode } from "@/modules/forms/admin/ui";
import { CourseTabs, StatusPill } from "@/modules/classroom/admin/tabs";
import { getCourse } from "@/modules/classroom/lib/courses";
import { PageHeader } from "../../header";

// Header and tabs shared by every screen of one course.
export default async function CourseLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser("classroom.view");
  const course = await getCourse(Number(id));
  if (!course) notFound();
  return (
    <>
      <PageHeader
        eyebrow={`Course #${course.id}`}
        title={
          <>
            {course.title} <StatusPill status={course.status} />
          </>
        }
        actions={<CopyCode text={`${site.url}/classroom/${course.slug}`}>/classroom/{course.slug}</CopyCode>}
      />
      <CourseTabs
        courseId={course.id}
        slug={course.slug}
        live={course.status === "active"}
        tabs={[
          { key: "builder", label: "Build" },
          { key: "settings", label: "Settings" },
          { key: "dashboard", label: "Analytics" },
        ]}
      />
      {children}
    </>
  );
}
