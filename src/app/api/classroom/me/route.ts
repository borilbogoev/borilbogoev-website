import { getCurrentUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { json } from "@/modules/auth/guard";
import { myCourses } from "@/modules/classroom/lib/me";
import { bankConfigured } from "@/modules/classroom/lib/settings";
import { getSettings } from "@/modules/classroom/lib/settings-store";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return json({ signedIn: false }, 200);
  const courses = await myCourses(user.id);
  const s = courses.some((c) => c.status === "pending") ? await getSettings() : null;
  return json(
    {
      signedIn: true,
      user: { name: user.name, email: user.email, staff: can(user.role, "classroom.view") },
      courses,
      bank: s && bankConfigured(s) ? { beneficiary: s.bank_beneficiary, bank: s.bank_name, iban: s.bank_iban, swift: s.bank_swift, instructions: s.bank_instructions } : null,
    },
    200,
  );
}
