import { getCurrentUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { json } from "@/modules/auth/guard";
import { getEnrolment, paymentReference } from "@/modules/school/lib/access";
import { getCourse } from "@/modules/school/lib/courses";
import { courseState } from "@/modules/school/lib/learn";
import { bankConfigured } from "@/modules/school/lib/settings";
import { getSettings } from "@/modules/school/lib/settings-store";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

// What the static course and lesson pages need to know about the person looking at them: who they are, whether they are
// enrolled, and what they finished. Signed out is a normal answer, not an error.
export async function GET(_request: Request, ctx: Ctx) {
  const course = await getCourse(Number((await ctx.params).id));
  if (!course) return json({ error: "Course not found." }, 404);
  const user = await getCurrentUser().catch(() => null);
  if (!user) return json({ signedIn: false }, 200);
  const staff = can(user.role, "school.view");
  const [enrolment, state] = await Promise.all([getEnrolment(user.id, course.id), courseState(user.id, course.id)]);
  const settings = enrolment?.status === "pending" ? await getSettings() : null;
  return json(
    {
      signedIn: true,
      user: { name: user.name, email: user.email, role: user.role, student: can(user.role, "school.learn") },
      staff,
      moderator: can(user.role, "school.moderate"),
      enrolment: enrolment ? { status: enrolment.status, reference: enrolment.status === "pending" ? paymentReference(enrolment) : null } : null,
      completed: state.completed,
      lastLessonId: state.lastLessonId,
      bank: settings && bankConfigured(settings) ? { beneficiary: settings.bank_beneficiary, bank: settings.bank_name, iban: settings.bank_iban, swift: settings.bank_swift, instructions: settings.bank_instructions } : null,
    },
    200,
  );
}
