"use client";

// The course builder. Same three panes as the Landing and Presentations builders: the course outline (and the block palette)
// on the left, the open lesson in the middle drawn with the real lesson styles, the settings of the selected block on the right.
// Structure (modules, lessons, their order) saves at once; lesson content saves with the Save button, so a half-edited
// lesson never reaches students.
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { ControlField, ImageControl, type ControlCtx, type ImageValue } from "@/modules/forms/admin/controls";
import { api, ApiError, Icon, Modal, useConfirm, useFormatters, useToast } from "@/modules/forms/admin/ui";
import type { Settings } from "@/modules/forms/lib/blocks";
import { BlockCtx, BlockView, type BlockContext } from "../components/blocks";
import { PIcon } from "@/modules/presentations/admin/picon";
import { BLOCK_GROUPS, BLOCKS, blockDefaults, isBlockType, type BlockType } from "../lib/blocks";
import { brandIssues, type BrandIssue } from "../lib/brand";
import type { Img } from "../lib/course-settings";
import "@/modules/landing/admin/landing-admin.css";
import "./classroom-admin.css";

export type OutlineLessonRow = { id: number; moduleId: number; title: string; slug: string; summary: string; status: "draft" | "active"; preview: boolean; minutes: number; image: Img };
export type OutlineModuleRow = { id: number; title: string; slug: string; summary: string; image: Img; lessons: OutlineLessonRow[] };

type EditBlock = { uid: number; id: number; type: BlockType; settings: Settings };
type EditLesson = { id: number; moduleId: number; title: string; slug: string; summary: string; image: ImageValue; status: "draft" | "active"; preview: boolean; minutes: number; blocks: EditBlock[] };
type ServerLesson = { id: number; moduleId: number; title: string; slug: string; summary: string; image: Img; status: "draft" | "active"; preview: boolean; minutes: number; blocks: { id: number; type: BlockType; settings: Settings }[] };
type Sel = { kind: "lesson" | "module"; id: number } | null;
type ModuleDraft = { title: string; slug: string; summary: string; image: ImageValue };

/** Brings a block of the open lesson into view. */
const scrollToBlock = (uid: number) => requestAnimationFrame(() => document.querySelector(`.bbc-builder [data-uid="${uid}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));

type Props = {
  courseId: number;
  courseSlug: string;
  courseStatus: string;
  siteUrl: string;
  initialModules: OutlineModuleRow[];
  initialLessonId: number | null;
  canWrite: boolean;
  canDelete: boolean;
};

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
let uidCounter = 0;
const nextUid = () => ++uidCounter;

const asImage = (i: Img | undefined): ImageValue => ({ id: 0, url: i?.url ?? "", width: i?.width, height: i?.height, variants: i?.variants });

const toEdit = (l: ServerLesson): EditLesson => ({
  id: l.id,
  moduleId: l.moduleId,
  title: l.title,
  slug: l.slug,
  summary: l.summary,
  image: asImage(l.image),
  status: l.status,
  preview: l.preview,
  minutes: l.minutes,
  blocks: l.blocks.map((b) => ({ uid: nextUid(), id: b.id, type: b.type, settings: b.settings })),
});

const EDITING: BlockContext = { editing: true, signedIn: false, state: {}, save: async () => {} };

export function CourseBuilder({ courseId, courseSlug, courseStatus, siteUrl, initialModules, initialLessonId, canWrite, canDelete }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const f = useFormatters();
  const [modules, setModules] = useState(initialModules);
  const [sel, setSel] = useState<Sel>(initialLessonId ? { kind: "lesson", id: initialLessonId } : null);
  const [lesson, setLesson] = useState<EditLesson | null>(null);
  const [loading, setLoading] = useState(false);
  const [blockSel, setBlockSel] = useState<number | null>(null);
  const [leftTab, setLeftTab] = useState<"outline" | "blocks">("outline");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const [newModule, setNewModule] = useState("");
  const [newLesson, setNewLesson] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<{ id: number; createdAt: string; blocks: number }[] | null>(null);
  const dragUid = useRef<number | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const loadedId = useRef<number | null>(null);

  const ctx: ControlCtx = useMemo(() => ({ uploadUrl: "/api/admin/classroom/media" }), []);
  const touch = useCallback(() => setDirty(true), []);
  const selBlock = lesson?.blocks.find((b) => b.uid === blockSel) ?? null;
  const issues: BrandIssue[] = useMemo(() => (lesson ? brandIssues({ title: lesson.title, summary: lesson.summary, image: lesson.image, blocks: lesson.blocks.map((b) => ({ id: b.id, type: b.type, settings: b.settings })) }) : []), [lesson]);
  const warns = issues.filter((i) => i.level === "warn").length;
  const mod = sel?.kind === "module" ? modules.find((m) => m.id === sel.id) ?? null : null;
  const lessonModule = lesson ? modules.find((m) => m.id === lesson.moduleId) ?? null : null;

  /* ---------- loading ---------- */

  const refreshTree = useCallback(async () => {
    const res = await api<{ modules: (Omit<OutlineModuleRow, "lessons"> & { lessons: OutlineLessonRow[] })[] }>(`classroom/courses/${courseId}`);
    setModules(res.modules.map((m) => ({ id: m.id, title: m.title, slug: m.slug, summary: m.summary, image: m.image, lessons: m.lessons })));
  }, [courseId]);

  const loadLesson = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const res = await api<{ lesson: ServerLesson }>(`classroom/lessons/${id}`);
      setLesson(toEdit(res.lesson));
      loadedId.current = id;
      setBlockSel(null);
      setDirty(false);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not open the lesson", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (sel?.kind === "lesson" && loadedId.current !== sel.id) void loadLesson(sel.id);
  }, [sel, loadLesson]);

  const open = async (next: Sel) => {
    if (dirty && !(await confirm("This lesson has unsaved changes. Leave without saving?", "Discard changes"))) return;
    setDirty(false);
    if (next?.kind === "module") {
      setLesson(null);
      loadedId.current = null;
    }
    setSel(next);
  };

  /* ---------- structure ---------- */

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok);
      return true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Something went wrong", "error");
      return false;
    }
  };

  const addModule = async () => {
    const title = newModule.trim() || `Module ${modules.length + 1}`;
    if (await run(() => api("classroom/modules", { method: "POST", body: { courseId, title } }))) {
      setNewModule("");
      await refreshTree();
    }
  };

  const addLesson = async (moduleId: number) => {
    const title = (newLesson[moduleId] ?? "").trim() || "New lesson";
    try {
      const res = await api<{ id: number }>("classroom/lessons", { method: "POST", body: { moduleId, title } });
      setNewLesson((cur) => ({ ...cur, [moduleId]: "" }));
      await refreshTree();
      await open({ kind: "lesson", id: res.id });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not add the lesson", "error");
    }
  };

  const saveOrder = async (next: OutlineModuleRow[]) => {
    setModules(next);
    if (await run(() => api(`classroom/courses/${courseId}/order`, { method: "PUT", body: { modules: next.map((m) => ({ id: m.id, lessons: m.lessons.map((l) => l.id) })) } }))) await refreshTree();
  };

  const moveModule = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= modules.length) return;
    const next = [...modules];
    [next[i], next[j]] = [next[j], next[i]];
    void saveOrder(next);
  };

  const moveLesson = (mi: number, li: number, d: -1 | 1) => {
    const next = modules.map((m) => ({ ...m, lessons: [...m.lessons] }));
    const list = next[mi].lessons;
    const lj = li + d;
    if (lj >= 0 && lj < list.length) {
      [list[li], list[lj]] = [list[lj], list[li]];
    } else {
      // Past the first or last lesson: it moves to the neighbouring module.
      const target = next[mi + d];
      if (!target) return;
      const [l] = list.splice(li, 1);
      if (d === -1) target.lessons.push(l);
      else target.lessons.unshift(l);
    }
    void saveOrder(next);
  };

  const removeModule = async (m: OutlineModuleRow) => {
    if (!(await confirm(`Delete the module "${m.title}" with its ${m.lessons.length} lessons, and every student's progress and notes in them? This cannot be undone.`, "Delete module"))) return;
    if (await run(() => api(`classroom/modules/${m.id}`, { method: "DELETE" }), "Module deleted")) {
      if (lesson && m.lessons.some((l) => l.id === lesson.id)) {
        setLesson(null);
        loadedId.current = null;
        setSel(null);
        setDirty(false);
      }
      if (sel?.kind === "module" && sel.id === m.id) setSel(null);
      await refreshTree();
    }
  };

  const removeLesson = async (l: OutlineLessonRow) => {
    if (!(await confirm(`Delete the lesson "${l.title}" and every student's progress, notes and answers in it? This cannot be undone.`, "Delete lesson"))) return;
    if (await run(() => api(`classroom/lessons/${l.id}`, { method: "DELETE" }), "Lesson deleted")) {
      if (lesson?.id === l.id) {
        setLesson(null);
        loadedId.current = null;
        setSel(null);
        setDirty(false);
      }
      await refreshTree();
    }
  };

  const saveModuleDraft = async (id: number, draft: ModuleDraft) => {
    if (await run(() => api(`classroom/modules/${id}`, { method: "PUT", body: draft }), "Module saved")) await refreshTree();
  };

  const moveLessonTo = async (moduleId: number) => {
    if (!lesson || moduleId === lesson.moduleId) return;
    if (dirty && !(await confirm("Save the lesson first, or the changes are lost. Move anyway?", "Move lesson"))) return;
    const next = modules.map((m) => ({ ...m, lessons: m.lessons.filter((l) => l.id !== lesson.id) }));
    const target = next.find((m) => m.id === moduleId);
    const src = modules.flatMap((m) => m.lessons).find((l) => l.id === lesson.id);
    if (!target || !src) return;
    target.lessons.push({ ...src, moduleId });
    await saveOrder(next);
    await loadLesson(lesson.id);
  };

  /* ---------- block operations ---------- */

  const addBlock = (type: BlockType, at?: number) => {
    if (!lesson) return;
    const b: EditBlock = { uid: nextUid(), id: 0, type, settings: blockDefaults(type) };
    setLesson((cur) => {
      if (!cur) return cur;
      const i = at ?? (blockSel !== null ? cur.blocks.findIndex((x) => x.uid === blockSel) + 1 : cur.blocks.length);
      const blocks = [...cur.blocks];
      blocks.splice(i <= 0 && blockSel === null ? cur.blocks.length : i, 0, b);
      return { ...cur, blocks };
    });
    setBlockSel(b.uid);
    touch();
    scrollToBlock(b.uid);
  };

  const moveBlock = (i: number, d: -1 | 1) => {
    setLesson((cur) => {
      if (!cur) return cur;
      const j = i + d;
      if (j < 0 || j >= cur.blocks.length) return cur;
      const blocks = [...cur.blocks];
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...cur, blocks };
    });
    touch();
  };

  const duplicateBlock = (i: number) => {
    setLesson((cur) => {
      if (!cur) return cur;
      const copy: EditBlock = { ...clone(cur.blocks[i]), id: 0, uid: nextUid() };
      const blocks = [...cur.blocks];
      blocks.splice(i + 1, 0, copy);
      setBlockSel(copy.uid);
      return { ...cur, blocks };
    });
    touch();
  };

  const removeBlock = async (i: number) => {
    if (!lesson) return;
    const b = lesson.blocks[i];
    if (b.id && !(await confirm(`Delete this ${BLOCKS[b.type].label} block? Students' answers in it are deleted when you save.`, "Delete block"))) return;
    setLesson((cur) => (cur ? { ...cur, blocks: cur.blocks.filter((x) => x.uid !== b.uid) } : cur));
    if (blockSel === b.uid) setBlockSel(null);
    touch();
  };

  const patchBlock = (uid: number, key: string, value: unknown) => {
    setLesson((cur) =>
      cur
        ? {
            ...cur,
            blocks: cur.blocks.map((b) => {
              if (b.uid !== uid) return b;
              const settings = { ...b.settings, [key]: value };
              // A changed video source has no signed address until the lesson is saved.
              if (b.type === "video" && key === "source") Object.assign(settings, { _embed: null, _missing: "unsaved" });
              if (b.type === "audio" && key === "url") Object.assign(settings, { _audio: null });
              return { ...b, settings };
            }),
          }
        : cur,
    );
    touch();
  };

  const patchLesson = <K extends keyof EditLesson>(key: K, value: EditLesson[K]) => {
    setLesson((cur) => (cur ? { ...cur, [key]: value } : cur));
    touch();
  };

  /* ---------- drag and drop ---------- */

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    const cards = Array.from(canvas.current?.querySelectorAll<HTMLElement>(".bbfa-block") ?? []);
    let at = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        at = i;
        break;
      }
    }
    setDropAt(at);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    if (!lesson) return;
    const at = dropAt ?? lesson.blocks.length;
    setDropAt(null);
    const nt = e.dataTransfer.getData("text/bbf-new");
    if (nt && isBlockType(nt)) return addBlock(nt, at);
    const from = lesson.blocks.findIndex((b) => b.uid === dragUid.current);
    if (from < 0) return;
    setLesson((cur) => {
      if (!cur) return cur;
      const blocks = [...cur.blocks];
      const [b] = blocks.splice(from, 1);
      blocks.splice(at > from ? at - 1 : at, 0, b);
      return { ...cur, blocks };
    });
    touch();
  };

  /* ---------- save ---------- */

  const save = useCallback(
    async (status?: "draft" | "active") => {
      if (!lesson || saving || !canWrite) return;
      setSaving(true);
      const selIndex = lesson.blocks.findIndex((b) => b.uid === blockSel);
      try {
        const res = await api<{ lesson: ServerLesson }>(`classroom/lessons/${lesson.id}`, {
          method: "PUT",
          body: {
            title: lesson.title,
            slug: lesson.slug || undefined,
            summary: lesson.summary,
            image: lesson.image,
            status: status ?? lesson.status,
            preview: lesson.preview,
            minutes: lesson.minutes,
            blocks: lesson.blocks.map((b) => ({ id: b.id, type: b.type, settings: b.settings })),
          },
        });
        const next = toEdit(res.lesson);
        setLesson(next);
        setBlockSel(selIndex > -1 && next.blocks[selIndex] ? next.blocks[selIndex].uid : null);
        setDirty(false);
        toast(status === "active" ? "Lesson published" : status === "draft" ? "Lesson unpublished" : "Lesson saved");
        await refreshTree();
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "Save failed", "error");
      } finally {
        setSaving(false);
      }
    },
    [lesson, saving, canWrite, blockSel, toast, refreshTree],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [save, dirty]);

  const openHistory = async () => {
    if (!lesson) return;
    try {
      setHistory((await api<{ revisions: { id: number; createdAt: string; blocks: number }[] }>(`classroom/lessons/${lesson.id}/revisions`)).revisions);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not load the history", "error");
    }
  };
  const restore = async (revisionId: number) => {
    if (!lesson) return;
    if (!(await confirm("Put this version back? The current content stays in the history. Students' answers to blocks are not carried over.", "Restore version"))) return;
    if (await run(() => api(`classroom/lessons/${lesson.id}/revisions`, { method: "POST", body: { revisionId } }), "Version restored")) {
      setHistory(null);
      await loadLesson(lesson.id);
    }
  };

  const live = lesson?.status === "active";
  const publicUrl = lesson && lessonModule ? `/classroom/${courseSlug}/${lessonModule.slug}/${lesson.slug}` : "";
  const totalLessons = modules.reduce((n, m) => n + m.lessons.length, 0);
  const liveLessons = modules.reduce((n, m) => n + m.lessons.filter((l) => l.status === "active").length, 0);

  return (
    <div className="bbfa-builder bbc-builder">
      {/* Left: outline and palette */}
      <aside className="bbfa-palette">
        <div className="bbp-ptabs" role="tablist">
          <button type="button" role="tab" aria-selected={leftTab === "outline"} className={leftTab === "outline" ? "is-active" : ""} onClick={() => setLeftTab("outline")}>
            Outline
          </button>
          <button type="button" role="tab" aria-selected={leftTab === "blocks"} className={leftTab === "blocks" ? "is-active" : ""} onClick={() => setLeftTab("blocks")} disabled={!lesson}>
            Add block
          </button>
        </div>

        {leftTab === "outline" ? (
          <>
            <p className="bbp-hint">
              {totalLessons} lessons, {liveLessons} published. Students see only published lessons.
            </p>
            <ul className="bbc-tree">
              {modules.map((m, mi) => (
                <li key={m.id} className={`bbc-mod${sel?.kind === "module" && sel.id === m.id ? " is-selected" : ""}`}>
                  <div className="bbc-mod__head">
                    <button type="button" className="bbc-pick" onClick={() => void open({ kind: "module", id: m.id })} title="Edit the module">
                      {mi + 1}. {m.title}
                    </button>
                    {canWrite ? (
                      <>
                        <button type="button" className="bbc-mini" title="Move up" disabled={mi === 0} onClick={() => moveModule(mi, -1)}>
                          <Icon name="up" />
                        </button>
                        <button type="button" className="bbc-mini" title="Move down" disabled={mi === modules.length - 1} onClick={() => moveModule(mi, 1)}>
                          <Icon name="down" />
                        </button>
                      </>
                    ) : null}
                    {canDelete ? (
                      <button type="button" className="bbc-mini" title="Delete module" onClick={() => void removeModule(m)}>
                        <Icon name="trash" />
                      </button>
                    ) : null}
                  </div>
                  <ul className="bbc-lessons">
                    {m.lessons.map((l, li) => (
                      <li key={l.id} className={sel?.kind === "lesson" && sel.id === l.id ? "is-selected" : ""}>
                        <button type="button" className="bbc-pick" onClick={() => void open({ kind: "lesson", id: l.id })}>
                          <i className={`bbc-dot${l.status === "active" ? " is-live" : ""}`} title={l.status === "active" ? "Published" : "Draft"} />
                          <span>{l.title}</span>
                        </button>
                        {canWrite ? (
                          <>
                            <button type="button" className="bbc-mini" title="Move up" disabled={mi === 0 && li === 0} onClick={() => moveLesson(mi, li, -1)}>
                              <Icon name="up" />
                            </button>
                            <button type="button" className="bbc-mini" title="Move down" disabled={mi === modules.length - 1 && li === m.lessons.length - 1} onClick={() => moveLesson(mi, li, 1)}>
                              <Icon name="down" />
                            </button>
                          </>
                        ) : null}
                        {canDelete ? (
                          <button type="button" className="bbc-mini" title="Delete lesson" onClick={() => void removeLesson(l)}>
                            <Icon name="trash" />
                          </button>
                        ) : null}
                      </li>
                    ))}
                    {!m.lessons.length ? <li style={{ padding: "6px 12px", color: "var(--bbfa-faint)", fontSize: 12 }}>No lessons yet.</li> : null}
                  </ul>
                  {canWrite ? (
                    <form
                      className="bbc-add"
                      style={{ padding: "0 8px 8px" }}
                      onSubmit={(e) => {
                        e.preventDefault();
                        void addLesson(m.id);
                      }}
                    >
                      <input type="text" value={newLesson[m.id] ?? ""} onChange={(e) => setNewLesson((cur) => ({ ...cur, [m.id]: e.target.value }))} placeholder="New lesson" aria-label={`New lesson in ${m.title}`} />
                      <button type="submit" className="bbfa-mini">
                        Add
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
            {canWrite ? (
              <form
                className="bbc-add"
                onSubmit={(e) => {
                  e.preventDefault();
                  void addModule();
                }}
              >
                <input type="text" value={newModule} onChange={(e) => setNewModule(e.target.value)} placeholder="New module" aria-label="New module" />
                <button type="submit" className="bbfa-mini">
                  Add
                </button>
              </form>
            ) : null}
          </>
        ) : (
          (Object.keys(BLOCK_GROUPS) as (keyof typeof BLOCK_GROUPS)[]).map((g) => (
            <div key={g}>
              <div className="bbfa-palette__group">{BLOCK_GROUPS[g]}</div>
              <div className="bbfa-palette__grid">
                {(Object.keys(BLOCKS) as BlockType[])
                  .filter((t) => BLOCKS[t].group === g)
                  .map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="bbfa-palette__item"
                      disabled={!canWrite || !lesson}
                      title={BLOCKS[t].desc}
                      draggable={canWrite}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/bbf-new", t);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => addBlock(t)}
                    >
                      <span className="bbfa-palette__icon">
                        <PIcon name={BLOCKS[t].icon} />
                      </span>
                      <span>{BLOCKS[t].label}</span>
                    </button>
                  ))}
              </div>
            </div>
          ))
        )}
      </aside>

      {/* Middle: the lesson */}
      <main className="bbfa-canvas" ref={canvas}>
        {courseStatus !== "active" ? (
          <p className="bbp-hint" style={{ marginTop: 0 }}>
            This course is <strong>{courseStatus}</strong>, so students cannot see it yet. Activate it under Settings when the first lessons are ready.
          </p>
        ) : null}

        {!lesson && !loading ? (
          <div className="bbfa-empty is-canvas">
            <div className="bbfa-empty__icon">
              B<i>*</i>
            </div>
            <h3>{mod ? "Edit the module on the right" : "Open a lesson"}</h3>
            <p>{mod ? "Change its title, short description and image. Students see them on the course page and at the top of the module." : "Pick a lesson in the outline, or add a module and a lesson to start."}</p>
          </div>
        ) : null}

        {loading ? <p className="bbfa-muted">Opening the lesson...</p> : null}

        {lesson && !loading ? (
          <>
            <div className="bbfa-canvas__head">
              <div className="bbfa-canvas__title">
                <input type="text" className="bbfa-title-input" value={lesson.title} aria-label="Lesson title" disabled={!canWrite} onChange={(e) => patchLesson("title", e.target.value)} />
                <span className={`bbfa-pill bbfa-pill--${live ? "active" : "draft"}`}>{live ? "Published" : "Draft"}</span>
                {canWrite ? (
                  <>
                    <button type="button" className={`bbfa-btn${live ? " bbfa-btn--ghost" : ""}${saving ? " is-loading" : ""}${dirty ? " is-dirty" : ""}`} onClick={() => void save()}>
                      <span>Save</span>
                    </button>
                    {live ? (
                      <button type="button" className="bbfa-btn bbfa-btn--ghost" onClick={() => void save("draft")}>
                        Unpublish
                      </button>
                    ) : (
                      <button type="button" className={`bbfa-btn${saving ? " is-loading" : ""}`} onClick={() => void save("active")}>
                        <span>Publish</span>
                      </button>
                    )}
                  </>
                ) : null}
              </div>
              <div className="bbfa-canvas__meta">
                {lessonModule?.title} · {lesson.blocks.length} blocks
                {live && courseStatus === "active" ? (
                  <>
                    {" "}
                    · <a href={publicUrl} target="_blank" rel="noopener noreferrer">View live ↗</a>
                  </>
                ) : null}{" "}
                ·{" "}
                <button type="button" className="bbfa-tag" onClick={() => void openHistory()}>
                  History
                </button>
                {canWrite ? null : " · view only"}
              </div>
              {issues.length ? (
                <button type="button" className={`bbfa-brandcheck${warns ? " has-warn" : ""}`} aria-expanded={showIssues} onClick={() => setShowIssues((v) => !v)}>
                  <Icon name="shield" />
                  Brand check: {warns ? `${warns} to fix` : "all clear"}
                  {issues.length - warns ? `, ${issues.length - warns} suggestion${issues.length - warns > 1 ? "s" : ""}` : ""}
                </button>
              ) : (
                <span className="bbfa-brandcheck">
                  <Icon name="shield" />
                  Brand check: all clear
                </span>
              )}
              {showIssues ? (
                <ul className="bbfa-issues">
                  {issues.map((i, k) => (
                    <li key={k} className={i.level === "warn" ? "is-warn" : ""}>
                      <button
                        type="button"
                        disabled={!i.blockId}
                        onClick={() => {
                          const b = lesson.blocks.find((x) => x.id === i.blockId);
                          if (b) {
                            setBlockSel(b.uid);
                            scrollToBlock(b.uid);
                          }
                        }}
                      >
                        {i.message}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <details key={lesson.id} className="bbc-lessonmeta" open={!lesson.summary && !lesson.image.url}>
              <summary>Lesson settings: summary, image, time, module, address, preview</summary>
              <fieldset disabled={!canWrite} style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: "grid", gap: 14 }}>
              <div className="bbfa-ctl">
                <label className="bbfa-label">Short summary (shows in the outline and under the title)</label>
                <textarea rows={2} value={lesson.summary} maxLength={400} onChange={(e) => patchLesson("summary", e.target.value)} />
              </div>
              <ImageControl label="Featured image" value={lesson.image} uploadUrl="/api/admin/classroom/media" onChange={(v) => patchLesson("image", v)} />
              <div className="bbc-grid">
                <div className="bbfa-ctl">
                  <label className="bbfa-label">Time to complete (minutes)</label>
                  <input type="number" min={0} max={1000} value={lesson.minutes} onChange={(e) => patchLesson("minutes", Math.max(0, Number(e.target.value) || 0))} />
                </div>
                <div className="bbfa-ctl">
                  <label className="bbfa-label">Module</label>
                  <select value={lesson.moduleId} onChange={(e) => void moveLessonTo(Number(e.target.value))}>
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bbfa-ctl">
                  <label className="bbfa-label">Address</label>
                  <input type="text" value={lesson.slug} onChange={(e) => patchLesson("slug", e.target.value.toLowerCase())} />
                  <small className="bbfa-muted">{siteUrl.replace(/^https?:\/\//, "")}/classroom/{courseSlug}/{lessonModule?.slug}/{lesson.slug}</small>
                </div>
              </div>
              <label className="bbfa-toggle">
                <input type="checkbox" checked={lesson.preview} onChange={(e) => patchLesson("preview", e.target.checked)} />
                <span className="bbfa-toggle__ui" />
                <span>
                  <span className="bbfa-label">Free preview</span>
                  <small>Anyone can open this lesson without enrolling, even in a paid course.</small>
                </span>
              </label>
              </fieldset>
            </details>

            <div className="bbfa-blocks bbc-canvasblocks" onDragOver={onDragOver} onDrop={onDrop} onDragLeave={() => setDropAt(null)}>
              {!lesson.blocks.length ? (
                <div className="bbfa-empty is-canvas">
                  <h3>This lesson is empty</h3>
                  <p>Open Add block on the left. A video, some text and a checklist make a good start.</p>
                </div>
              ) : null}
              {lesson.blocks.map((b, i) => {
                const T = BLOCKS[b.type];
                return (
                  <div
                    key={b.uid}
                    data-uid={b.uid}
                    tabIndex={0}
                    draggable={canWrite}
                    className={`bbfa-block${blockSel === b.uid ? " is-selected" : ""}${dropAt === i ? " drop-before" : ""}${dropAt === lesson.blocks.length && i === lesson.blocks.length - 1 ? " drop-after" : ""}`}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest(".bbfa-block__tools")) return;
                      setBlockSel(b.uid);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && setBlockSel(b.uid)}
                    onDragStart={(e) => {
                      dragUid.current = b.uid;
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", "bbf");
                    }}
                    onDragEnd={() => {
                      dragUid.current = null;
                      setDropAt(null);
                    }}
                  >
                    <div className="bbfa-block__head">
                      <span className="bbfa-grip">
                        <Icon name="grip" />
                      </span>
                      <span className="bbfa-block__type">
                        <PIcon name={T.icon} />
                        <span>{T.label}</span>
                      </span>
                    </div>
                    <div className="bbc-blockbody">
                      <BlockCtx.Provider value={EDITING}>
                        <BlockView block={{ id: b.uid, type: b.type, settings: b.settings }} />
                      </BlockCtx.Provider>
                    </div>
                    {canWrite ? (
                      <div className="bbfa-block__tools">
                        <button type="button" title="Move up" disabled={i === 0} onClick={() => moveBlock(i, -1)}>
                          <Icon name="up" />
                        </button>
                        <button type="button" title="Move down" disabled={i === lesson.blocks.length - 1} onClick={() => moveBlock(i, 1)}>
                          <Icon name="down" />
                        </button>
                        <button type="button" title="Duplicate" onClick={() => duplicateBlock(i)}>
                          <Icon name="copy" />
                        </button>
                        <button type="button" title="Delete" className="is-danger" onClick={() => void removeBlock(i)}>
                          <Icon name="trash" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </main>

      {/* Right: settings of the selected block, or of the module */}
      <aside className="bbfa-inspector">
        {selBlock ? (
          <>
            <div className="bbfa-inspector__head">
              <span className="bbfa-palette__icon">
                <PIcon name={BLOCKS[selBlock.type].icon} />
              </span>
              <div>
                <div className="bbfa-eyebrow">Block settings</div>
                <h3>{BLOCKS[selBlock.type].label}</h3>
              </div>
            </div>
            <p className="bbfa-inspector__desc">{BLOCKS[selBlock.type].desc}</p>
            <fieldset className="bbfa-inspector__body" disabled={!canWrite} style={{ border: 0, margin: 0, minWidth: 0 }}>
              {BLOCKS[selBlock.type].controls.map((c) => (
                <ControlField key={c.key} control={c} settings={selBlock.settings} set={(k, v) => patchBlock(selBlock.uid, k, v)} ctx={ctx} />
              ))}
            </fieldset>
          </>
        ) : mod ? (
          <ModuleInspector key={mod.id} mod={mod} courseSlug={courseSlug} canWrite={canWrite} onSave={(draft) => saveModuleDraft(mod.id, draft)} />
        ) : (
          <div className="bbfa-inspector__empty">
            <div className="bbfa-empty__icon">
              <Icon name="edit" />
            </div>
            <h4>{lesson ? "Select a block" : "Nothing selected"}</h4>
            <p>{lesson ? "Click any block to edit its content and settings. Videos, flashcards and the other blocks all work here." : "Open a lesson, or click a module name to edit it."}</p>
            <div className="bbfa-shortcuts">
              <div>
                <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>S</kbd> Save
              </div>
              <div>Drag blocks to reorder</div>
            </div>
          </div>
        )}
      </aside>

      {history ? (
        <Modal onClose={() => setHistory(null)} small>
          <div className="bbfa-eyebrow">Lesson</div>
          <h3 style={{ margin: "4px 0 14px" }}>Version history</h3>
          {history.length ? (
            <ul className="bbfa-rev">
              {history.map((r) => (
                <li key={r.id}>
                  <span>
                    <strong>Saved</strong> <em>· {r.blocks} blocks</em>
                  </span>
                  <em>{f.dateTime(r.createdAt)}</em>
                  {canWrite ? (
                    <button type="button" className="bbfa-mini" onClick={() => void restore(r.id)}>
                      Restore
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="bbfa-muted">No saved versions yet. The last 30 saves are kept.</p>
          )}
        </Modal>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ModuleInspector({ mod, courseSlug, canWrite, onSave }: { mod: OutlineModuleRow; courseSlug: string; canWrite: boolean; onSave: (draft: ModuleDraft) => void }) {
  const [d, setD] = useState<ModuleDraft>({ title: mod.title, slug: mod.slug, summary: mod.summary, image: asImage(mod.image) });
  return (
    <>
      <div className="bbfa-inspector__head">
        <span className="bbfa-palette__icon">
          <Icon name="grid" />
        </span>
        <div>
          <div className="bbfa-eyebrow">Module</div>
          <h3>{mod.title}</h3>
        </div>
      </div>
      <fieldset className="bbfa-inspector__body" disabled={!canWrite} style={{ border: 0, margin: 0, minWidth: 0 }}>
        <div className="bbfa-ctl">
          <label className="bbfa-label">Title</label>
          <input type="text" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
        </div>
        <div className="bbfa-ctl">
          <label className="bbfa-label">Short description</label>
          <textarea rows={3} value={d.summary} maxLength={400} onChange={(e) => setD({ ...d, summary: e.target.value })} />
        </div>
        <ImageControl label="Image" value={d.image} uploadUrl="/api/admin/classroom/media" onChange={(v) => setD({ ...d, image: v })} />
        <div className="bbfa-ctl">
          <label className="bbfa-label">Address</label>
          <input type="text" value={d.slug} onChange={(e) => setD({ ...d, slug: e.target.value.toLowerCase() })} />
          <small>
            /classroom/{courseSlug}/{d.slug}
          </small>
        </div>
        {canWrite ? (
          <button type="button" className="bbfa-btn" onClick={() => onSave(d)}>
            Save module
          </button>
        ) : null}
      </fieldset>
    </>
  );
}
