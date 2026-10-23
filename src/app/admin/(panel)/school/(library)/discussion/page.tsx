import { requireUser } from "@/modules/auth/current";
import { SchoolTabs } from "@/modules/school/admin/library-header";
import { DiscussionList } from "@/modules/school/admin/discussion-list";
import { inbox, sharedAnswers } from "@/modules/school/lib/learn";
import { PageHeader } from "../../../header";

export const metadata = { title: "School discussion" };

export default async function DiscussionPage() {
  const user = await requireUser("school.moderate", "/admin/school/discussion");
  const [questions, answers] = await Promise.all([inbox(), sharedAnswers()]);
  return (
    <>
      <PageHeader
        eyebrow="School"
        title={
          <>
            Discussion<span className="bbfa-dot">.</span>
          </>
        }
      />
      <SchoolTabs role={user.role} />
      <DiscussionList questions={questions} answers={answers} />
    </>
  );
}
