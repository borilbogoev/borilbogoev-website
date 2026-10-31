import Link from "next/link";
import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { SchoolTabs } from "@/modules/school/admin/library-header";
import { EnrolUsers } from "@/modules/school/admin/enrol-users";
import { StudentsManager } from "@/modules/school/admin/students-manager";
import { listEnrolments } from "@/modules/school/lib/access";
import { formatPrice } from "@/modules/school/lib/course-settings";
import { listCourses } from "@/modules/school/lib/courses";
import { PageHeader } from "../../../header";

export const metadata = { title: "School students" };

type SP = { course?: string; status?: string; q?: string };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("school.view", "/admin/school/students");
  const { course = "", status = "", q = "" } = await searchParams;
  const [rows, courses] = await Promise.all([listEnrolments({ courseId: Number(course) || undefined, status, q }), listCourses({ status: "" })]);
  return (
    <>
      <PageHeader
        eyebrow="School"
        title={
          <>
            Students<span className="bbfa-dot">.</span>
          </>
        }
      />
      <SchoolTabs role={user.role} />
      <StudentsManager
        canEnrol={can(user.role, "school.enrol")}
        between={can(user.role, "school.enrol") ? <EnrolUsers courses={courses.filter((c) => c.status !== "archived").map((c) => ({ id: c.id, title: c.title }))} initialCourse={course} /> : null}
        filters={{ course, status, q }}
        courses={courses.map((c) => ({ id: c.id, title: c.title, access: c.access }))}
        rows={rows.map((r) => ({
          id: r.id,
          userEmail: r.userEmail,
          userName: r.userName,
          userRole: r.userRole,
          userStatus: r.userStatus,
          courseId: r.courseId,
          courseTitle: r.courseTitle,
          status: r.status,
          source: r.source,
          reference: r.reference,
          amountLabel: r.amountCents ? formatPrice(r.amountCents, r.currency) : "Free",
          paidAt: r.paidAt,
          note: r.note,
          createdAt: r.createdAt,
          completed: r.completed,
          lessons: r.lessons,
        }))}
      />
      <p className="bbfa-muted" style={{ marginTop: 24 }}>
        Students are users with the role Student. Change a role, disable an account or reset a password in <Link href="/admin/users">Users</Link>.
      </p>
    </>
  );
}
