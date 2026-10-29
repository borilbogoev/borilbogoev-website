import { accountCourses } from "@/modules/account/lib/data";
import { requireAccountUser } from "@/modules/account/lib/session";
import { CourseSnippet, Empty, PageHead } from "@/modules/account/components/ui";

export const metadata = { title: "My Courses" };

export default async function CoursesPage() {
  const user = await requireAccountUser();
  const courses = await accountCourses(user.id);
  return (
    <>
      <PageHead eyebrow="School" title="My courses" intro="Every course you are enrolled in, with your progress." />
      {courses.length ? (
        <div className="ac-grid ac-grid--wide">
          {courses.map((c) => (
            <CourseSnippet key={c.id} c={c} />
          ))}
        </div>
      ) : (
        <Empty title="You are not enrolled in a course yet" text="Courses you join appear here with your progress and a way back in." href="/school" label="Browse the School" />
      )}
    </>
  );
}
