import { guarded, json } from "@/modules/auth/guard";
import { deleteEnrolment, getEnrolmentById, notifyAccessGranted, setEnrolment, type EnrolmentStatus } from "@/modules/school/lib/access";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

// status: "active" confirms a bank transfer (or restores access), "revoked" removes access but keeps progress, "pending" undoes a confirmation.
export async function PATCH(request: Request, ctx: Ctx) {
  return guarded(request, "school.enrol", async () => {
    const body = (await request.json().catch(() => ({}))) as { status?: string; note?: string };
    const status = ["pending", "active", "revoked"].includes(String(body.status)) ? (body.status as EnrolmentStatus) : undefined;
    const id = Number((await ctx.params).id);
    const before = await getEnrolmentById(id);
    const e = await setEnrolment(id, { status, note: typeof body.note === "string" ? body.note : undefined });
    if (!e) return json({ error: "Enrolment not found." }, 404);
    // Opening a course that was not open tells the student, so they do not have to guess.
    const mail = before && before.status !== "active" && e.status === "active" ? await notifyAccessGranted(e) : undefined;
    return json({ enrolment: e, ...(mail ? { mail } : {}) }, 200);
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return guarded(request, "school.enrol", async () => {
    await deleteEnrolment(Number((await ctx.params).id));
    return json({ deleted: true }, 200);
  });
}
