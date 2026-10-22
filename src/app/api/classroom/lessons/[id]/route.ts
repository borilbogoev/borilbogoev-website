import { json } from "@/modules/auth/guard";
import { listComments, lessonBlockState, lessonPollResults, getNote } from "@/modules/classroom/lib/learn";
import { isModerator, lessonContext, playerBlocks, REASONS } from "@/modules/classroom/lib/lesson-api";
import { getEnrolment } from "@/modules/classroom/lib/access";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

// Everything the lesson player shows for one lesson. The blocks are sent only to someone allowed to open the lesson, so paid
// content is never in the static page.
export async function GET(_request: Request, ctx: Ctx) {
  const c = await lessonContext(Number((await ctx.params).id));
  if (!c) return json({ error: "Lesson not found." }, 404);
  if (!c.access.ok) return json({ error: REASONS[c.access.reason], reason: c.access.reason }, c.access.reason === "signin" ? 401 : 403);

  const { user, course, lesson } = c;
  const base = { reason: c.access.reason, blocks: await playerBlocks(lesson) };
  if (!user) return json({ ...base, state: {}, note: null, comments: null, results: {} }, 200);

  const moderator = isModerator(user);
  const enrolled = c.access.reason === "enrolled" || c.access.reason === "staff" || (await getEnrolment(user.id, course.id))?.status === "active";
  const [state, note, comments, results] = await Promise.all([
    lessonBlockState(user.id, lesson.id),
    getNote(user.id, lesson.id),
    course.settings.comments && enrolled ? listComments(lesson.id, { id: user.id, moderator }) : Promise.resolve(null),
    lessonPollResults(user.id, lesson.id),
  ]);
  return json({ ...base, state, note, comments, results }, 200);
}
