import { guarded, json } from "@/modules/auth/guard";
import { deleteEnrolment, setEnrolment, type EnrolmentStatus } from "@/modules/classroom/lib/access";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

// status: "active" confirms a bank transfer (or restores access), "revoked" removes access but keeps progress, "pending" undoes a confirmation.
export async function PATCH(request: Request, ctx: Ctx) {
  return guarded(request, "classroom.enrol", async () => {
    const body = (await request.json().catch(() => ({}))) as { status?: string; note?: string };
    const status = ["pending", "active", "revoked"].includes(String(body.status)) ? (body.status as EnrolmentStatus) : undefined;
    const e = await setEnrolment(Number((await ctx.params).id), { status, note: typeof body.note === "string" ? body.note : undefined });
    return e ? json({ enrolment: e }, 200) : json({ error: "Enrolment not found." }, 404);
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return guarded(request, "classroom.enrol", async () => {
    await deleteEnrolment(Number((await ctx.params).id));
    return json({ deleted: true }, 200);
  });
}
