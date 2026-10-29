import Link from "next/link";
import { accountCourses, accountForms } from "@/modules/account/lib/data";
import { getProfile, profileCompleteness } from "@/modules/account/lib/profile";
import { requireAccountUser } from "@/modules/account/lib/session";
import { CourseSnippet, Empty, fmtDate, PageHead, ProfileSummary, SectionHead } from "@/modules/account/components/ui";

export const metadata = { title: "Home" };

// Home: a short look at everything the person has here. More blocks will land on this page as the area grows.
export default async function AccountHome() {
  const user = await requireAccountUser();
  const [profile, courses, forms] = await Promise.all([getProfile(user.id), accountCourses(user.id), accountForms(user.id, user.email)]);
  if (!profile) return null;
  const first = (profile.name || profile.username || "").split(/\s+/)[0];
  return (
    <>
      <PageHead eyebrow="Home" title={first ? `Welcome, ${first}` : "Welcome"} intro="Your courses, your answers and your details, in one place." />

      <section aria-labelledby="h-info">
        <SectionHead eyebrow="Profile" title="About me" href="/account/info" linkLabel="My info" />
        <ProfileSummary p={profile} completeness={profileCompleteness(profile)} />
      </section>

      <section className="ac-section" aria-labelledby="h-courses">
        <SectionHead eyebrow="School" title="My courses" href={courses.length ? "/account/courses" : undefined} linkLabel="All my courses" />
        {courses.length ? (
          <div className="ac-grid ac-grid--wide">
            {courses.slice(0, 4).map((c) => (
              <CourseSnippet key={c.id} c={c} compact />
            ))}
          </div>
        ) : (
          <Empty title="No courses yet" text="When you are enrolled in a course, it appears here with your progress." href="/school" label="Browse the School" />
        )}
      </section>

      <section className="ac-section" aria-labelledby="h-forms">
        <SectionHead eyebrow="Forms" title="My responses" href={forms.length ? "/account/responses" : undefined} linkLabel="All my responses" />
        {forms.length ? (
          <div className="ac-grid">
            {forms.map((f) => (
              <article key={f.formId} className="ac-card">
                <div className="ac-card__body">
                  <p className="ac-count">{f.responses}</p>
                  <h3 className="ac-card__title">{f.title}</h3>
                  <p className="ac-card__sub">
                    {f.responses === 1 ? "1 response" : `${f.responses} responses`} · last on {fmtDate(f.lastAt)}
                  </p>
                </div>
                <div className="ac-card__foot">
                  <Link href={f.responses === 1 ? `/account/responses/${f.lastId}` : `/account/responses?form=${f.formId}`} className="bb-btn bb-btn-outline ac-btn-sm">
                    {f.responses === 1 ? "View my answers" : "View my responses"}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="No responses yet" text="Forms you fill in with your email address show up here, so you can read your own answers again." />
        )}
      </section>
    </>
  );
}
