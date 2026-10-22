"use client";

// The Classroom player: a left sidebar with the course outline, the lesson in the middle and a right sidebar with the
// discussion and the student's notes. The pages around it are static; everything personal (who you are, what you finished,
// the lesson content itself) is fetched here after the page loads.
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LIcon } from "@/modules/landing/components/icons";
import type { CommentView } from "../lib/learn";
import { BlockCtx, BlockList, type BlockContext, type PlayerBlock } from "./blocks";
import { api, ApiError } from "./client-api";
import { Discussion, Notes } from "./discussion";
import { EnrolPanel } from "./enrol";
import type { CourseStateData, LessonData, OutlineLesson, OutlineModule, ShellCourse } from "./types";
import { useCourseState } from "./use-course-state";

type Flat = OutlineLesson & { moduleSlug: string; moduleTitle: string; href: string };

type PlayerValue = {
  course: ShellCourse;
  modules: OutlineModule[];
  flat: Flat[];
  state: CourseStateData;
  reloadState: () => Promise<void>;
  patchState: (p: Partial<CourseStateData>) => void;
  lesson: LessonData;
  lessonId: number | null;
  reloadLesson: () => Promise<void>;
  setComments: (c: CommentView[]) => void;
  canOpen: (l: OutlineLesson) => boolean;
  href: (moduleSlug: string, lessonSlug?: string) => string;
};

const PlayerCtx = createContext<PlayerValue | null>(null);
export const usePlayer = () => {
  const v = useContext(PlayerCtx);
  if (!v) throw new Error("usePlayer needs the PlayerShell.");
  return v;
};

/* -------------------------------------------------------------------------- */
/* Shell                                                                      */
/* -------------------------------------------------------------------------- */

type LessonPayload = { reason: string; blocks: PlayerBlock[]; state: Record<number, Record<string, unknown>>; note: { body: string; updatedAt: string | null } | null; comments: CommentView[] | null; results?: Record<number, number[]> };

async function fetchLesson(id: number): Promise<LessonData> {
  try {
    const res = await api<LessonPayload>(`lessons/${id}`);
    return { status: "ok", reason: res.reason, blocks: res.blocks, state: res.state ?? {}, note: res.note, comments: res.comments, results: res.results ?? {} };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return { status: "denied", reason: String(e.body.reason ?? "enrol"), message: e.message };
    return { status: "error", message: e instanceof Error ? e.message : "The lesson could not be loaded." };
  }
}

export function PlayerShell({ course, modules, children }: { course: ShellCourse; modules: OutlineModule[]; children: ReactNode }) {
  const params = useParams<{ module?: string; lesson?: string }>();
  const { state, reload, patch } = useCourseState(course.id);
  const [fetched, setFetched] = useState<{ id: number; data: LessonData } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [leftFor, setLeftFor] = useState<string | null>(null);
  const [rightFor, setRightFor] = useState<string | null>(null);
  const [tab, setTab] = useState<"discussion" | "notes">("discussion");
  const [collapsed, setCollapsed] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });

  const href = useCallback((m: string, l?: string) => `${course.base}/${m}${l ? `/${l}` : ""}`, [course.base]);
  const flat: Flat[] = useMemo(() => modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleSlug: m.slug, moduleTitle: m.title, href: href(m.slug, l.slug) }))), [modules, href]);

  const current = flat.find((l) => l.moduleSlug === params.module && l.slug === params.lesson) ?? null;
  const lessonId = current?.id ?? null;

  // The mobile drawers close by themselves when the student moves to another page: they are open only for the page they were opened on.
  const navKey = `${params.module ?? ""}/${params.lesson ?? ""}`;
  const left = leftFor === navKey;
  const right = rightFor === navKey;

  const canOpen = useCallback((l: OutlineLesson) => state.staff || state.enrolment?.status === "active" || l.preview, [state.staff, state.enrolment]);

  useEffect(() => {
    if (lessonId === null) return;
    let alive = true;
    void fetchLesson(lessonId).then((data) => alive && setFetched({ id: lessonId, data }));
    return () => {
      alive = false;
    };
  }, [lessonId, reloadKey, state.enrolment?.status, state.signedIn]);

  const lesson: LessonData = lessonId === null ? { status: "idle" } : fetched?.id === lessonId ? fetched.data : { status: "loading" };

  // Opening a lesson records it, so "Continue learning" brings the student back here.
  useEffect(() => {
    if (lessonId === null || lesson.status !== "ok" || !state.signedIn || course.preview) return;
    void api(`lessons/${lessonId}/progress`, { method: "POST", body: {} }).catch(() => {});
  }, [lessonId, lesson.status, state.signedIn, course.preview]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const raw = localStorage.getItem("cr_sidebars");
        if (raw) setCollapsed({ left: false, right: false, ...JSON.parse(raw) });
      } catch {
        /* private mode: the sidebars simply start open */
      }
    });
  }, []);
  const toggleSide = (side: "left" | "right") =>
    setCollapsed((c) => {
      const next = { ...c, [side]: !c[side] };
      try {
        localStorage.setItem("cr_sidebars", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

  const reloadLesson = useCallback(async () => setReloadKey((k) => k + 1), []);
  const setComments = useCallback((comments: CommentView[]) => setFetched((f) => (f && f.data.status === "ok" ? { ...f, data: { ...f.data, comments } } : f)), []);

  const value: PlayerValue = { course, modules, flat, state, reloadState: reload, patchState: patch, lesson, lessonId, reloadLesson, setComments, canOpen, href };

  const total = flat.length;
  const done = flat.filter((l) => state.completed.includes(l.id)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const here = typeof window === "undefined" ? course.base : window.location.pathname;
  const signInHref = `/classroom/sign-in?next=${encodeURIComponent(here)}`;
  const enrolled = state.staff || state.enrolment?.status === "active";

  return (
    <PlayerCtx.Provider value={value}>
      <div className={`cr-player${lessonId !== null ? " has-right" : ""}${left ? " is-left" : ""}${right ? " is-right" : ""}${collapsed.left ? " is-left-collapsed" : ""}${collapsed.right ? " is-right-collapsed" : ""}`}>
        <header className="cr-bar">
          <Link className="cr-bar__back" href={course.preview ? `/admin/classroom/${course.id}/builder` : course.base}>
            <LIcon name="left" size={18} />
            <span>{course.title}</span>
          </Link>
          <div className="cr-bar__progress" title={`${done} of ${total} lessons done`}>
            <div className="cr-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress">
              <span style={{ width: `${pct}%` }} />
            </div>
            <span className="cr-meta">{state.signedIn ? `${pct}%` : ""}</span>
          </div>
          <nav className="cr-bar__nav">
            <button type="button" className="cr-iconbtn cr-only-narrow" onClick={() => setLeftFor((v) => (v === navKey ? null : navKey))} aria-expanded={left} aria-controls="cr-left">
              Lessons
            </button>
            {lessonId !== null ? (
              <button type="button" className="cr-iconbtn cr-only-medium" onClick={() => setRightFor((v) => (v === navKey ? null : navKey))} aria-expanded={right} aria-controls="cr-right">
                Discussion
              </button>
            ) : null}
            {course.preview ? (
              <span className="cr-chip cr-chip--red" title="Staff preview: drafts are listed and nothing you do is recorded as progress">
                Preview
              </span>
            ) : state.signedIn ? (
              <Link className="cr-bar__link" href="/classroom/my">
                My courses
              </Link>
            ) : state.loaded && !course.preview ? (
              <Link className="cr-bar__link" href={signInHref}>
                Sign in
              </Link>
            ) : null}
          </nav>
        </header>

        <div className="cr-grid">
          <aside id="cr-left" className="cr-side cr-side--left" aria-label="Course outline">
            <Outline />
          </aside>
          <button type="button" className="cr-edge cr-edge--left" onClick={() => toggleSide("left")} aria-label={collapsed.left ? "Show the outline" : "Hide the outline"}>
            <LIcon name={collapsed.left ? "right" : "left"} size={16} />
          </button>
          <main id="main" className="cr-main">
            {children}
          </main>
          {lessonId !== null ? (
            <>
              <button type="button" className="cr-edge cr-edge--right" onClick={() => toggleSide("right")} aria-label={collapsed.right ? "Show discussion and notes" : "Hide discussion and notes"}>
                <LIcon name={collapsed.right ? "left" : "right"} size={16} />
              </button>
              <aside id="cr-right" className="cr-side cr-side--right" aria-label="Discussion and notes">
                <div className="cr-tabs" role="tablist">
                  <button type="button" role="tab" aria-selected={tab === "discussion"} className={tab === "discussion" ? "is-on" : ""} onClick={() => setTab("discussion")}>
                    Discussion
                  </button>
                  <button type="button" role="tab" aria-selected={tab === "notes"} className={tab === "notes" ? "is-on" : ""} onClick={() => setTab("notes")}>
                    Notes
                  </button>
                </div>
                <div className="cr-side__body" role="tabpanel">
                  {lesson.status === "ok" || lesson.status === "denied" ? (
                    tab === "discussion" ? (
                      <Discussion
                        key={`d-${lessonId}`}
                        lessonId={lessonId}
                        courseId={course.id}
                        signedIn={state.signedIn}
                        enrolled={enrolled}
                        moderator={state.moderator}
                        commentsOn={course.comments}
                        comments={lesson.status === "ok" ? lesson.comments : null}
                        onComments={setComments}
                        signInHref={signInHref}
                      />
                    ) : (
                      <Notes key={`n-${lessonId}`} lessonId={lessonId} courseId={course.id} initial={lesson.status === "ok" ? (lesson.note?.body ?? "") : null} signedIn={state.signedIn && lesson.status === "ok"} signInHref={signInHref} />
                    )
                  ) : lesson.status === "error" ? null : (
                    <p className="cr-side__empty">Loading</p>
                  )}
                </div>
              </aside>
            </>
          ) : null}
          {left || right ? <button type="button" className="cr-scrim" onClick={() => (setLeftFor(null), setRightFor(null))} aria-label="Close the panel" /> : null}
        </div>
      </div>
    </PlayerCtx.Provider>
  );
}

/* -------------------------------------------------------------------------- */
/* Outline (left sidebar)                                                     */
/* -------------------------------------------------------------------------- */

function Outline() {
  const { modules, flat, state, canOpen, href, lessonId } = usePlayer();
  const params = useParams<{ module?: string }>();
  const openModule = params.module;
  const done = (id: number) => state.completed.includes(id);
  return (
    <nav className="cr-outline">
      {modules.map((m, mi) => {
        const lessons = m.lessons;
        const n = lessons.filter((l) => done(l.id)).length;
        return (
          <details key={m.id} open={m.slug === openModule || (!openModule && mi === 0)} className="cr-outline__module">
            <summary>
              <span className="cr-outline__num">{String(mi + 1).padStart(2, "0")}</span>
              <span className="cr-outline__title">{m.title}</span>
              <span className="cr-meta">
                {n}/{lessons.length}
              </span>
            </summary>
            <ul>
              <li>
                <Link href={href(m.slug)} className={!lessonId && m.slug === openModule ? "is-current" : ""}>
                  <span className="cr-outline__mark" aria-hidden="true" />
                  <span>About this module</span>
                </Link>
              </li>
              {lessons.map((l) => {
                const current = l.id === lessonId;
                const locked = state.loaded && !canOpen(l);
                return (
                  <li key={l.id}>
                    <Link href={href(m.slug, l.slug)} className={current ? "is-current" : ""} aria-current={current ? "page" : undefined}>
                      <span className={`cr-outline__mark${done(l.id) ? " is-done" : ""}`} aria-hidden="true">
                        {done(l.id) ? <LIcon name="check" size={12} /> : null}
                      </span>
                      <span>
                        {l.title}
                        {l.minutes ? <small>{l.minutes} min</small> : null}
                      </span>
                      {l.draft ? <span className="cr-chip cr-chip--red">Draft</span> : locked ? <LIcon name="lock" size={14} className="cr-outline__lock" /> : l.preview && !state.staff ? <span className="cr-chip">Free</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
      <p className="cr-outline__foot cr-meta">
        {flat.length} lessons{state.signedIn ? `, ${flat.filter((l) => done(l.id)).length} done` : ""}
      </p>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Module page: the list of lessons                                           */
/* -------------------------------------------------------------------------- */

export function ModuleLessons({ moduleSlug }: { moduleSlug: string }) {
  const { modules, state, canOpen, href } = usePlayer();
  const m = modules.find((x) => x.slug === moduleSlug);
  if (!m) return null;
  return (
    <ol className="cr-lessonlist">
      {m.lessons.map((l, i) => {
        const done = state.completed.includes(l.id);
        const locked = state.loaded && !canOpen(l);
        return (
          <li key={l.id}>
            <Link href={href(m.slug, l.slug)} className="cr-lessonlist__item">
              <span className={`cr-outline__mark cr-outline__mark--lg${done ? " is-done" : ""}`} aria-hidden="true">
                {done ? <LIcon name="check" size={14} /> : String(i + 1)}
              </span>
              <span className="cr-lessonlist__text">
                <strong>{l.title}</strong>
                {l.summary ? <small>{l.summary}</small> : null}
              </span>
              <span className="cr-lessonlist__meta">
                {l.minutes ? <span className="cr-meta">{l.minutes} min</span> : null}
                {l.draft ? <span className="cr-chip cr-chip--red">Draft</span> : locked ? <LIcon name="lock" size={16} /> : l.preview && !state.staff ? <span className="cr-chip">Free</span> : null}
              </span>
            </Link>
          </li>
        );
      })}
      {!m.lessons.length ? <li className="cr-side__empty">No lessons in this module yet.</li> : null}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Lesson body                                                                */
/* -------------------------------------------------------------------------- */

export function LessonBody() {
  const p = usePlayer();
  const router = useRouter();
  const { lesson, lessonId, flat, state, course } = p;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const index = flat.findIndex((l) => l.id === lessonId);
  const cur = index >= 0 ? flat[index] : null;
  const prev = index > 0 ? flat[index - 1] : null;
  const next = index >= 0 && index < flat.length - 1 ? flat[index + 1] : null;
  const done = lessonId !== null && state.completed.includes(lessonId);

  const ctx: BlockContext = useMemo(
    () => ({
      editing: false,
      signedIn: state.signedIn,
      state: (lesson.status === "ok" ? lesson.state : {}) as BlockContext["state"],
      results: lesson.status === "ok" ? lesson.results : {},
      save: async (blockId, data) => api<{ data: Record<string, unknown>; results?: number[] }>(`lessons/${lessonId}/blocks/${blockId}/state`, { method: "PUT", body: data }),
    }),
    [lesson, state.signedIn, lessonId],
  );

  if (!cur || lessonId === null) return null;

  const mark = async (value: boolean, goNext: boolean) => {
    setBusy(true);
    setError("");
    try {
      await api(`lessons/${lessonId}/progress`, { method: "POST", body: { done: value } });
      p.patchState({ completed: value ? [...new Set([...state.completed, lessonId])] : state.completed.filter((x) => x !== lessonId) });
      if (goNext && value) router.push(next ? next.href : course.preview ? `/admin/classroom/${course.id}/builder` : `${course.base}?finished=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (lesson.status === "idle" || lesson.status === "loading") {
    return (
      <div className="cr-skeleton" aria-busy="true" aria-label="Loading the lesson">
        <span />
        <span />
        <span />
      </div>
    );
  }
  if (lesson.status === "error") {
    return (
      <div className="cr-gate">
        <p role="alert" className="cr-error">
          {lesson.message}
        </p>
        <button type="button" className="bb-btn bb-btn-outline" onClick={() => void p.reloadLesson()}>
          Try again
        </button>
      </div>
    );
  }
  if (lesson.status === "denied") {
    return (
      <div className="cr-gate">
        <p className="cr-eyebrow">{lesson.reason === "signin" ? "Sign in" : lesson.reason === "pending" ? "Payment" : "Enrol"}</p>
        <h2>{lesson.reason === "closed" ? "This lesson is not open yet" : "This lesson is part of the course"}</h2>
        <p className="cr-gate__text">{lesson.message}</p>
        {lesson.reason !== "closed" ? <EnrolPanel course={course} state={state} next={cur.href} startHref={cur.href} onChange={async () => void (await p.reloadState())} /> : null}
        {cur.summary ? <p className="cr-hint">{cur.summary}</p> : null}
      </div>
    );
  }

  return (
    <BlockCtx.Provider value={ctx}>
      <BlockList blocks={lesson.blocks} />
      <footer className="cr-lessonfoot">
        {lesson.reason === "preview" && !state.signedIn ? (
          <p className="cr-hint">
            This lesson is a free preview. <Link href={`/classroom/sign-in?next=${encodeURIComponent(cur.href)}`}>Sign in</Link> to keep your progress and notes.
          </p>
        ) : null}
        <div className="cr-lessonfoot__bar">
          {prev ? (
            <Link className="bb-btn bb-btn-outline" href={prev.href} rel="prev">
              <LIcon name="left" size={16} /> Previous
            </Link>
          ) : (
            <span />
          )}
          {state.signedIn ? (
            done ? (
              <div className="cr-lessonfoot__done">
                <span className="cr-chip cr-chip--ok">
                  <LIcon name="check" size={12} /> Completed
                </span>
                <button type="button" className="cr-link" onClick={() => void mark(false, false)} disabled={busy}>
                  Mark as not complete
                </button>
                {next ? (
                  <Link className="bb-btn bb-btn-primary" href={next.href} rel="next">
                    Next lesson <LIcon name="right" size={16} />
                  </Link>
                ) : null}
              </div>
            ) : (
              <button type="button" className="bb-btn bb-btn-primary" onClick={() => void mark(true, true)} disabled={busy}>
                {busy ? "Saving" : next ? "Mark complete and continue" : "Mark complete and finish"}
              </button>
            )
          ) : next ? (
            <Link className="bb-btn bb-btn-outline" href={next.href} rel="next">
              Next <LIcon name="right" size={16} />
            </Link>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="cr-error">
            {error}
          </p>
        ) : null}
      </footer>
    </BlockCtx.Provider>
  );
}
