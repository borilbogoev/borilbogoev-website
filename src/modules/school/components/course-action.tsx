"use client";

import { EnrolPanel } from "./enrol";
import type { ShellCourse } from "./types";
import { useCourseState } from "./use-course-state";

/** Enrol, continue or pay: the call to action on the course page. The page is static, so the state comes from the browser. */
export function CourseAction({ course, firstHref, lessonHrefs, total }: { course: ShellCourse; firstHref: string; lessonHrefs: Record<number, string>; total: number }) {
  const { state, reload } = useCourseState(course.id);
  const resume = state.lastLessonId ? lessonHrefs[state.lastLessonId] : undefined;
  const done = state.completed.filter((id) => lessonHrefs[id]).length;
  return (
    <div className="cr-action">
      <EnrolPanel course={course} state={state} next={`/school/${course.slug}`} startHref={resume ?? firstHref} onChange={reload} />
      {state.signedIn && state.enrolment?.status === "active" && total ? (
        <div className="cr-action__progress">
          <div className="cr-progress" role="progressbar" aria-valuenow={Math.round((done / total) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Your progress">
            <span style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <span className="cr-meta">
            {done} of {total} lessons done
          </span>
        </div>
      ) : null}
    </div>
  );
}
