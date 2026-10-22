import { json } from "@/modules/auth/guard";
import { enrolSelf } from "@/modules/classroom/lib/access";
import { getCourse } from "@/modules/classroom/lib/courses";
import { learner } from "@/modules/classroom/lib/lesson-api";
import { bankConfigured } from "@/modules/classroom/lib/settings";
import { getSettings } from "@/modules/classroom/lib/settings-store";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  return learner(request, async (user) => {
    const course = await getCourse(Number((await ctx.params).id));
    if (!course) return json({ error: "Course not found." }, 404);
    const res = await enrolSelf(user, course);
    if (!res.ok) return json({ error: res.error }, 409);
    const pending = res.enrolment.status === "pending";
    const s = pending ? await getSettings() : null;
    return json(
      {
        status: res.enrolment.status,
        reference: res.reference,
        bank: s && bankConfigured(s) ? { beneficiary: s.bank_beneficiary, bank: s.bank_name, iban: s.bank_iban, swift: s.bank_swift, instructions: s.bank_instructions } : null,
      },
      200,
    );
  });
}
