// Shared by the learner API routes: load a lesson, check the caller's access, build the payload the player needs.
import { can } from "@/modules/auth/roles";
import { getCurrentUser, type CurrentUser } from "@/modules/auth/current";
import { guarded, json } from "@/modules/auth/guard";
import { lessonAccess, type Access } from "./access";
import { getCourse, getLesson, type Course, type Lesson } from "./courses";
import { embedSrc, parseAudio, parseVideoRef } from "./media";
import { getBunnyKey, getSettings } from "./settings-store";
import type { Settings } from "./blocks";

export type LessonContext = { user: CurrentUser | null; course: Course; lesson: Lesson; access: Access };

/** The lesson, its course and what the (possibly signed-out) caller may do. Null when the lesson does not exist. */
export async function lessonContext(lessonId: number): Promise<LessonContext | null> {
  const lesson = await getLesson(lessonId);
  if (!lesson) return null;
  const course = await getCourse(lesson.courseId);
  if (!course) return null;
  const user = await getCurrentUser().catch(() => null);
  return { user, course, lesson, access: await lessonAccess(user, course, lesson) };
}

export const isModerator = (user: CurrentUser | null) => !!user && can(user.role, "classroom.moderate");
export const isStaff = (user: CurrentUser | null) => !!user && can(user.role, "classroom.view");

/** For routes a signed-in person uses to learn: students and staff. */
export function learner(request: Request, handler: (user: CurrentUser) => Promise<Response>) {
  return guarded(request, undefined, async (user) => {
    if (!can(user.role, "classroom.learn") && !can(user.role, "classroom.view")) return json({ error: "Your account cannot use the Classroom." }, 403);
    return handler(user);
  });
}

export const REASONS: Record<string, string> = {
  signin: "Sign in to open this lesson.",
  enrol: "Enrol in the course to open this lesson.",
  pending: "Your payment is not confirmed yet. The course opens as soon as it is.",
  closed: "This lesson is not available right now.",
};

/** Block settings as the player receives them: videos carry a short-lived signed address, never the Bunny key. */
export async function playerBlocks(lesson: Lesson, opts: { forBuilder?: boolean } = {}) {
  const [settings, key] = await Promise.all([getSettings(), getBunnyKey().catch(() => "")]);
  return lesson.blocks.map((b) => {
    let s: Settings = b.settings;
    if (b.type === "video") {
      const ref = parseVideoRef(String(s.source ?? ""), settings.bunny_library_id);
      const src = ref ? embedSrc(ref, { bunnyKey: key, ttlHours: settings.bunny_token_hours }) : null;
      s = { ...s, _embed: src, _provider: ref?.provider ?? "", _missing: !src ? (String(s.source ?? "").trim() ? "unplayable" : "empty") : "" };
    }
    if (b.type === "audio") {
      const a = parseAudio(String(s.url ?? ""));
      s = { ...s, _audio: a ?? null };
    }
    void opts;
    return { id: b.id, type: b.type, settings: s };
  });
}
