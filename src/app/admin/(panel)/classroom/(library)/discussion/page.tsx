import { requireUser } from "@/modules/auth/current";
import { ClassroomTabs } from "@/modules/classroom/admin/library-header";
import { DiscussionList } from "@/modules/classroom/admin/discussion-list";
import { inbox, sharedAnswers } from "@/modules/classroom/lib/learn";
import { PageHeader } from "../../../header";

export const metadata = { title: "Classroom discussion" };

export default async function DiscussionPage() {
  const user = await requireUser("classroom.moderate", "/admin/classroom/discussion");
  const [questions, answers] = await Promise.all([inbox(), sharedAnswers()]);
  return (
    <>
      <PageHeader
        eyebrow="Classroom"
        title={
          <>
            Discussion<span className="bbfa-dot">.</span>
          </>
        }
      />
      <ClassroomTabs role={user.role} />
      <DiscussionList questions={questions} answers={answers} />
    </>
  );
}
