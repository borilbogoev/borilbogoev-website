import { learner } from "@/modules/school/lib/lesson-api";
import { getCourse } from "@/modules/school/lib/courses";
import { courseNotes } from "@/modules/school/lib/learn";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

// All of the signed-in student's notes in one course, as a Markdown download.
export async function GET(request: Request, ctx: Ctx) {
  return learner(request, async (user) => {
    const course = await getCourse(Number((await ctx.params).id));
    if (!course) return Response.json({ error: "Course not found." }, { status: 404 });
    const notes = await courseNotes(user.id, course.id);
    let md = `# Notes: ${course.title}\n`;
    let current = "";
    for (const n of notes) {
      if (n.module !== current) {
        current = n.module;
        md += `\n## ${current}\n`;
      }
      md += `\n### ${n.title}\n\n${n.body}\n`;
    }
    if (!notes.length) md += "\nYou have not written any notes in this course yet.\n";
    return new Response(md, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${course.slug}-notes.md"`, "Cache-Control": "no-store" } });
  });
}
