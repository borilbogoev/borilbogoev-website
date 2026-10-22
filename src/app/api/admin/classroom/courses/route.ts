import { guarded, json } from "@/modules/auth/guard";
import { createCourse, listCourses, publicCourse } from "@/modules/classroom/lib/courses";
import { refreshClassroom } from "@/modules/classroom/lib/revalidate";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return guarded(request, "classroom.view", async () => {
    const p = new URL(request.url).searchParams;
    const items = await listCourses({ q: p.get("q") ?? "", status: p.get("status") ?? "", category: Number(p.get("category")) || undefined });
    return json({ courses: items.map((c) => ({ ...publicCourse(c), categoryName: c.categoryName, modules: c.modules, lessons: c.lessons, students: c.students, pending: c.pending })) }, 200);
  });
}

export async function POST(request: Request) {
  return guarded(request, "classroom.write", async (user) => {
    const body = (await request.json().catch(() => ({}))) as { title?: string; slug?: string; categoryId?: number | null; access?: string; template?: string };
    const id = await createCourse({ title: String(body.title ?? ""), slug: body.slug ? String(body.slug) : undefined, categoryId: body.categoryId ? Number(body.categoryId) : null, access: body.access, template: body.template }, user.id);
    await refreshClassroom();
    return json({ id }, 201);
  });
}
