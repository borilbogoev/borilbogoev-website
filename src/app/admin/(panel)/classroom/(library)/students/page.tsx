import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { ClassroomTabs } from "@/modules/classroom/admin/library-header";
import { StudentsManager } from "@/modules/classroom/admin/students-manager";
import { listEnrolments } from "@/modules/classroom/lib/access";
import { formatPrice } from "@/modules/classroom/lib/course-settings";
import { listCourses } from "@/modules/classroom/lib/courses";
import { PageHeader } from "../../../header";

export const metadata = { title: "Classroom students" };

type SP = { course?: string; status?: string; q?: string };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("classroom.view", "/admin/classroom/students");
  const { course = "", status = "", q = "" } = await searchParams;
  const [rows, courses] = await Promise.all([listEnrolments({ courseId: Number(course) || undefined, status, q }), listCourses({ status: "" })]);
  return (
    <>
      <PageHeader
        eyebrow="Classroom"
        title={
          <>
            Students<span className="bbfa-dot">.</span>
          </>
        }
      />
      <ClassroomTabs role={user.role} />
      <StudentsManager
        canEnrol={can(user.role, "classroom.enrol")}
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
        Students are users with the role Student. Change a role, disable an account or reset a password in <a href="/admin/users">Users</a>.
      </p>
    </>
  );
}
