"use client";

// The right sidebar of a lesson: the discussion (questions for the class or only for the instructor) and the student's private notes.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LIcon } from "@/modules/landing/components/icons";
import type { CommentView } from "../lib/learn";
import { api, when } from "./client-api";

type Props = {
  lessonId: number;
  courseId: number;
  signedIn: boolean;
  enrolled: boolean;
  moderator: boolean;
  commentsOn: boolean;
  comments: CommentView[] | null;
  onComments: (c: CommentView[]) => void;
  signInHref: string;
};

/* -------------------------------------------------------------------------- */
/* Discussion                                                                 */
/* -------------------------------------------------------------------------- */

function Composer({ placeholder, parentId, lessonId, moderator, onDone, autoFocus, cta }: { placeholder: string; parentId?: number; lessonId: number; moderator: boolean; onDone: (c: CommentView[]) => void; autoFocus?: boolean; cta: string }) {
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"class" | "instructor">("class");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const submit = async () => {
    if (!body.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<{ comments: CommentView[] }>(`lessons/${lessonId}/comments`, { body: { body, visibility, parentId } });
      setBody("");
      onDone(res.comments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="cr-compose"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <textarea ref={ref} rows={parentId ? 2 : 3} value={body} maxLength={4000} placeholder={placeholder} aria-label={placeholder} onChange={(e) => setBody(e.target.value)} />
      <div className="cr-compose__bar">
        {!parentId && !moderator ? (
          <fieldset className="cr-seg" aria-label="Who can read this">
            <label className={visibility === "class" ? "is-on" : ""}>
              <input type="radio" name={`vis-${parentId ?? "new"}`} checked={visibility === "class"} onChange={() => setVisibility("class")} />
              Class
            </label>
            <label className={visibility === "instructor" ? "is-on" : ""}>
              <input type="radio" name={`vis-${parentId ?? "new"}`} checked={visibility === "instructor"} onChange={() => setVisibility("instructor")} />
              Only instructor
            </label>
          </fieldset>
        ) : (
          <span />
        )}
        <button type="submit" className="bb-btn bb-btn-dark cr-btn-sm" disabled={busy || !body.trim()}>
          {busy ? "Sending" : cta}
        </button>
      </div>
      {error ? (
        <p role="alert" className="cr-error">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function Comment({ c, replies, props }: { c: CommentView; replies: CommentView[]; props: Props }) {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.body);
  const [error, setError] = useState("");

  const act = async (patch: Record<string, unknown>) => {
    setError("");
    try {
      await api(`comments/${c.id}`, { method: "PATCH", body: patch });
      props.onComments((await api<{ comments: CommentView[] }>(`lessons/${props.lessonId}/comments`)).comments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  };
  const remove = async () => {
    if (!window.confirm("Delete this comment and its replies?")) return;
    try {
      await api(`comments/${c.id}`, { method: "DELETE" });
      props.onComments((await api<{ comments: CommentView[] }>(`lessons/${props.lessonId}/comments`)).comments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  };

  return (
    <li className={`cr-comment${c.hidden ? " is-hidden" : ""}${c.pinned ? " is-pinned" : ""}`} id={`comment-${c.id}`}>
      <div className="cr-comment__head">
        <strong>{c.author}</strong>
        {c.staff ? <span className="cr-chip cr-chip--red">Instructor</span> : null}
        {c.visibility === "instructor" && !c.parentId ? (
          <span className="cr-chip">
            <LIcon name="lock" size={12} /> Only instructor
          </span>
        ) : null}
        {c.pinned ? <span className="cr-chip">Pinned</span> : null}
        {c.resolved && !c.parentId ? <span className="cr-chip cr-chip--ok">Answered</span> : null}
        {c.hidden ? <span className="cr-chip">Hidden</span> : null}
        <time dateTime={c.createdAt}>{when(c.createdAt)}</time>
      </div>
      {editing ? (
        <div className="cr-compose">
          <textarea rows={3} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} aria-label="Edit your comment" />
          <div className="cr-compose__bar">
            <button type="button" className="cr-link" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="bb-btn bb-btn-dark cr-btn-sm"
              onClick={async () => {
                await act({ body: text });
                setEditing(false);
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <p className="cr-comment__body">{c.body}</p>
      )}
      {c.editedAt ? <small className="cr-meta">Edited</small> : null}
      <div className="cr-comment__actions">
        {props.enrolled || props.moderator ? (
          <button type="button" onClick={() => setReplying((r) => !r)}>
            Reply
          </button>
        ) : null}
        {c.mine && !editing ? <button type="button" onClick={() => setEditing(true)}>Edit</button> : null}
        {c.mine || props.moderator ? <button type="button" onClick={remove}>Delete</button> : null}
        {!c.parentId && (props.moderator || c.mine) ? <button type="button" onClick={() => act({ resolved: !c.resolved })}>{c.resolved ? "Reopen" : "Mark answered"}</button> : null}
        {!c.parentId && (c.mine || props.moderator) ? <button type="button" onClick={() => act({ visibility: c.visibility === "class" ? "instructor" : "class" })}>{c.visibility === "class" ? "Make private" : "Make public"}</button> : null}
        {props.moderator ? <button type="button" onClick={() => act({ hidden: !c.hidden })}>{c.hidden ? "Show" : "Hide"}</button> : null}
        {props.moderator && !c.parentId ? <button type="button" onClick={() => act({ pinned: !c.pinned })}>{c.pinned ? "Unpin" : "Pin"}</button> : null}
      </div>
      {error ? (
        <p role="alert" className="cr-error">
          {error}
        </p>
      ) : null}
      {replies.length ? (
        <ul className="cr-comment__replies">
          {replies.map((r) => (
            <Comment key={r.id} c={r} replies={[]} props={props} />
          ))}
        </ul>
      ) : null}
      {replying ? (
        <Composer
          placeholder="Write a reply"
          parentId={c.id}
          lessonId={props.lessonId}
          moderator={props.moderator}
          autoFocus
          cta="Reply"
          onDone={(list) => {
            setReplying(false);
            props.onComments(list);
          }}
        />
      ) : null}
    </li>
  );
}

export function Discussion(props: Props) {
  const { comments, signedIn, enrolled, moderator, commentsOn } = props;
  const threads = useMemo(() => {
    const all = comments ?? [];
    const top = all.filter((c) => !c.parentId);
    return top.map((t) => ({ t, replies: all.filter((c) => c.parentId === t.id) }));
  }, [comments]);

  if (!commentsOn) return <p className="cr-side__empty">Questions are switched off for this course.</p>;
  if (!signedIn) {
    return (
      <p className="cr-side__empty">
        <Link href={props.signInHref}>Sign in</Link> and enrol to ask a question or join the discussion.
      </p>
    );
  }
  if (!enrolled && !moderator) return <p className="cr-side__empty">Enrol in the course to ask questions and read the class discussion.</p>;

  return (
    <div className="cr-discuss">
      <Composer placeholder="Ask a question or share a thought" lessonId={props.lessonId} moderator={moderator} cta="Post" onDone={props.onComments} />
      {comments === null ? <p className="cr-side__empty">Loading</p> : null}
      {comments && !threads.length ? <p className="cr-side__empty">No questions yet. Be the first to ask.</p> : null}
      <ul className="cr-threads">
        {threads.map(({ t, replies }) => (
          <Comment key={t.id} c={t} replies={replies} props={props} />
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Notes                                                                      */
/* -------------------------------------------------------------------------- */

export function Notes({ lessonId, courseId, initial, signedIn, signInHref }: { lessonId: number; courseId: number; initial: string | null; signedIn: boolean; signInHref: string }) {
  const [body, setBody] = useState(initial ?? "");
  const [status, setStatus] = useState<"" | "saving" | "saved" | "error">("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(body);

  useEffect(() => {
    const t = timer;
    return () => {
      if (t.current) clearTimeout(t.current);
    };
  }, []);

  if (!signedIn) {
    return (
      <p className="cr-side__empty">
        <Link href={signInHref}>Sign in</Link> to keep private notes on this lesson.
      </p>
    );
  }

  const save = (text: string) => {
    latest.current = text;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await api(`lessons/${lessonId}/note`, { method: "PUT", body: { body: latest.current } });
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, 800);
  };

  return (
    <div className="cr-notes">
      <label htmlFor={`note-${lessonId}`} className="cr-notes__label">
        Your notes on this lesson
      </label>
      <textarea
        id={`note-${lessonId}`}
        value={body}
        maxLength={20000}
        placeholder="Write what you want to remember. Only you can read it."
        onChange={(e) => {
          setBody(e.target.value);
          save(e.target.value);
        }}
      />
      <div className="cr-notes__bar">
        <span className="cr-meta" aria-live="polite">
          {status === "saving" ? "Saving" : status === "saved" ? "Saved" : status === "error" ? "Not saved. Check your connection." : "Private to you"}
        </span>
        <a className="cr-link" href={`/api/school/courses/${courseId}/notes`} download>
          Export all notes
        </a>
      </div>
    </div>
  );
}
