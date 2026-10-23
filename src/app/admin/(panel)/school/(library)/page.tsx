import Link from "next/link";
import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { SchoolTabs } from "@/modules/school/admin/library-header";
import { CoursesTable } from "@/modules/school/admin/courses-table";
import { COURSE_STATUSES, formatPrice, STATUS_LABELS } from "@/modules/school/lib/course-settings";
import { listCategories, listCourses } from "@/modules/school/lib/courses";
import { PageHeader } from "../../header";
import "@/modules/landing/admin/landing-admin.css";
import "@/modules/school/admin/school-admin.css";

export const metadata = { title: "School" };

type SP = { q?: string; status?: string; category?: string };

export default async function SchoolListPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("school.view", "/admin/school");
  const { q = "", status = "", category = "" } = await searchParams;
  const [courses, categories, all] = await Promise.all([listCourses({ q, status, category: Number(category) || undefined }), listCategories(), listCourses({ status: "" })]);
  const canWrite = can(user.role, "school.write");
  const n = (v: number) => v.toLocaleString("en-US");
  const filtered = !!(q || status || category);
  const pending = all.reduce((t, c) => t + c.pending, 0);
  return (
    <>
      <PageHeader
        eyebrow="School"
        title={
          <>
            Courses<span className="bbfa-dot">.</span>
          </>
        }
        actions={canWrite ? <Link className="bbfa-btn" href="/admin/school/new">+ New course</Link> : null}
      />
      <SchoolTabs role={user.role} />
      <section className="bbfa-band">
        <div><strong>{n(all.length)}</strong><span>Courses</span></div>
        <div><strong>{n(all.filter((c) => c.status === "active").length)}</strong><span>Active</span></div>
        <div><strong>{n(all.reduce((t, c) => t + c.lessons, 0))}</strong><span>Lessons</span></div>
        <div><strong>{n(all.reduce((t, c) => t + c.students, 0))}</strong><span>Enrolments</span></div>
        <div>
          <strong>{n(pending)}</strong>
          <span>{pending ? <Link href="/admin/school/students?status=pending">Awaiting payment</Link> : "Awaiting payment"}</span>
        </div>
      </section>
      <section className="bbfa-section">
        <div className="bbfa-section__head">
          <div>
            <div className="bbfa-eyebrow">Library</div>
            <h2>{status === "archived" ? "Archived courses" : "All courses"}</h2>
          </div>
        </div>
        <form method="get" className="bbc-filters">
          <input type="search" name="q" defaultValue={q} placeholder="Search courses..." aria-label="Search" />
          <select name="status" defaultValue={status} aria-label="Status">
            <option value="">Any status</option>
            {COURSE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select name="category" defaultValue={category} aria-label="Category">
            <option value="">Any category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.courses})
              </option>
            ))}
          </select>
          <button type="submit" className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm">
            Filter
          </button>
          {filtered ? <Link href="/admin/school">Clear</Link> : null}
        </form>
        {courses.length ? (
          <CoursesTable
            canWrite={canWrite}
            canDelete={can(user.role, "school.delete")}
            siteUrl={site.url}
            rows={courses.map((c) => ({
              id: c.id,
              title: c.title,
              slug: c.slug,
              status: c.status,
              categoryName: c.categoryName,
              access: c.access,
              priceLabel: c.access === "paid" ? formatPrice(c.priceCents, c.currency) : c.access === "invite" ? "By invitation" : "Free",
              language: c.language,
              modules: c.modules,
              lessons: c.lessons,
              students: c.students,
              pending: c.pending,
              updatedAt: c.updatedAt.toISOString(),
              thumb: c.image.variants?.[0]?.url ?? c.image.url ?? "",
            }))}
          />
        ) : (
          <div className="bbfa-empty">
            <div className="bbfa-empty__icon">
              B<i>*</i>
            </div>
            <h3>{filtered ? "No courses match." : "Teach what you build. Create your first course."}</h3>
            <p>A course holds modules, a module holds lessons, and a lesson is built from blocks: video, text, flashcards, checklists and more. Courses live at {site.url.replace(/^https?:\/\//, "")}/school/&lt;name&gt;.</p>
            {canWrite && !filtered ? <Link className="bbfa-btn" href="/admin/school/new">+ Create a course</Link> : null}
          </div>
        )}
      </section>
    </>
  );
}
