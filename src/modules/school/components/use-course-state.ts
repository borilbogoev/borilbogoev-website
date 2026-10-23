"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./client-api";
import type { CourseStateData } from "./types";

const EMPTY: CourseStateData = { loaded: false, signedIn: false, staff: false, moderator: false, enrolment: null, completed: [], lastLessonId: null, bank: null };

async function fetchState(courseId: number): Promise<CourseStateData> {
  try {
    const s = await api<Partial<CourseStateData>>(`courses/${courseId}/state`);
    return { ...EMPTY, ...s, loaded: true, completed: s.completed ?? [] };
  } catch {
    return { ...EMPTY, loaded: true };
  }
}

/** Who is looking at this course and what they finished. The pages are static, so this is fetched in the browser. */
export function useCourseState(courseId: number) {
  const [state, setState] = useState<CourseStateData>(EMPTY);
  useEffect(() => {
    let alive = true;
    void fetchState(courseId).then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, [courseId]);
  const reload = useCallback(async () => setState(await fetchState(courseId)), [courseId]);
  const patch = useCallback((p: Partial<CourseStateData>) => setState((s) => ({ ...s, ...p })), []);
  return { state, reload, patch };
}
