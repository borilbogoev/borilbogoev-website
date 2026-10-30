import { guarded, json } from "@/modules/auth/guard";
import { adminEnrol, getEnrolment, notifyAccessGranted } from "@/modules/school/lib/access";
import { getCourse } from "@/modules/school/lib/courses";
import { cleanEmail, cleanText } from "@/modules/forms/lib/sanitize";
import { createUser, getUserByEmail } from "@/modules/auth/users";

export const runtime = "nodejs";

// Adds a student to a course by email. A person with no account gets a student account (no password: they sign in with an
// emailed link or Google); a person who already has an account keeps their role and is just enrolled. The student is emailed
// that the course is open (unless they already had it), and the answer says whether that email went out.
export async function POST(request: Request) {
  return guarded(request, "school.enrol", async () => {
    const body = (await request.json().catch(() => ({}))) as { email?: string; name?: string; courseId?: number; paid?: boolean; note?: string };
    const email = cleanEmail(body.email).toLowerCase();
    if (!email) return json({ error: "Enter a valid email address." }, 400);
    const course = await getCourse(Number(body.courseId));
    if (!course) return json({ error: "Choose a course." }, 400);
    let user = await getUserByEmail(email);
    const created = !user;
    if (!user) user = await createUser({ email, name: cleanText(body.name, 120), role: "student", password: null });
    if (user.status !== "active") return json({ error: "This account is disabled. Enable it in Users first." }, 409);
    const before = await getEnrolment(user.id, course.id);
    const enrolment = await adminEnrol(user.id, course, { note: typeof body.note === "string" ? body.note : undefined, paid: !!body.paid });
    const mail = before?.status === "active" ? undefined : await notifyAccessGranted(enrolment, { newAccount: created });
    return json({ enrolment, created, ...(mail ? { mail } : {}) }, 201);
  });
}
