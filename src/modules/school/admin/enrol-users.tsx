"use client";

// Search the registered users, tick some, enrol them in a course. People are ordinary users (any role), not a second list.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, Card, SelectField, TextField, Toggle, useToast } from "@/modules/forms/admin/ui";
import { ROLE_LABELS, type Role } from "@/modules/auth/roles";
import type { UserHit } from "../lib/access";
import "@/modules/landing/admin/landing-admin.css";
import "./school-admin.css";

export function EnrolUsers({ courses, initialCourse }: { courses: { id: number; title: string }[]; initialCourse: string }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [courseId, setCourseId] = useState(initialCourse || (courses[0] ? String(courses[0].id) : ""));
  const [hits, setHits] = useState<UserHit[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [paid, setPaid] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(
      () => {
        api<{ users: UserHit[] }>("school/users", { query: { q, course: courseId } })
          .then((r) => alive && setHits(r.users))
          .catch((e) => alive && toast(e instanceof ApiError ? e.message : "Could not search the users", "error"));
      },
      q ? 250 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, courseId, toast]);

  const selectable = (hits ?? []).filter((h) => h.enrolment !== "active");
  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOn = selectable.length > 0 && selectable.every((h) => picked.has(h.id));

  const enrol = async () => {
    if (!picked.size || !courseId || busy) return;
    setBusy(true);
    try {
      const res = await api<{ enrolled: number; skipped: number }>("school/students/bulk", { method: "POST", body: { userIds: [...picked], courseId: Number(courseId), paid, note } });
      toast(`${res.enrolled} ${res.enrolled === 1 ? "person" : "people"} enrolled${res.skipped ? `, ${res.skipped} skipped` : ""}`);
      setPicked(new Set());
      setNote("");
      setPaid(false);
      router.refresh();
      const r = await api<{ users: UserHit[] }>("school/users", { query: { q, course: courseId } });
      setHits(r.users);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not enrol", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!courses.length) return null;
  return (
    <div className="bbc-new" style={{ marginTop: 32, maxWidth: 820 }}>
      <Card eyebrow="Registered users" title="Find people and enrol them" desc="Search everyone who has an account: students, and staff too. Tick the people to add, choose the course, then enrol.">
        <SelectField label="Course" value={courseId} onChange={(v) => (setCourseId(v), setPicked(new Set()))} choices={Object.fromEntries(courses.map((c) => [String(c.id), c.title]))} />
        <TextField label="Search by name or email" value={q} onChange={setQ} placeholder="Start typing..." />
        <div className="bbfa-field bbfa-field--wide">
          {hits === null ? (
            <p className="bbfa-muted">Loading...</p>
          ) : hits.length ? (
            <>
              <label className="bbc-pickrow bbc-pickrow--all">
                <input type="checkbox" checked={allOn} disabled={!selectable.length} onChange={() => setPicked(allOn ? new Set() : new Set(selectable.map((h) => h.id)))} />
                <span>Select all shown ({selectable.length})</span>
              </label>
              <ul className="bbc-picklist">
                {hits.map((h) => (
                  <li key={h.id}>
                    <label className={`bbc-pickrow${h.enrolment === "active" ? " is-done" : ""}`}>
                      <input type="checkbox" checked={picked.has(h.id)} disabled={h.enrolment === "active"} onChange={() => toggle(h.id)} />
                      <span>
                        <strong>{h.name || h.email}</strong>
                        <small>
                          {h.name ? `${h.email} · ` : ""}
                          {ROLE_LABELS[h.role as Role] ?? h.role}
                        </small>
                      </span>
                      {h.enrolment ? <em>{h.enrolment === "active" ? "Already enrolled" : h.enrolment === "pending" ? "Awaiting payment" : "Access removed"}</em> : null}
                    </label>
                  </li>
                ))}
              </ul>
              {hits.length === 50 ? <small className="bbfa-muted">Showing the first 50. Type more of the name or email to narrow it down.</small> : null}
            </>
          ) : (
            <p className="bbfa-muted">No registered user matches. To invite someone new, use Add a student below.</p>
          )}
        </div>
        <TextField label="Note (optional)" value={note} onChange={setNote} placeholder="Bank reference, discount, reason" />
        <div className="bbfa-field">
          <Toggle label="Mark as paid" checked={paid} onChange={setPaid} help="Records today as the payment date. Leave off for a free seat." />
        </div>
      </Card>
      <p>
        <button type="button" className={`bbfa-btn${busy ? " is-loading" : ""}`} disabled={!picked.size || busy} onClick={() => void enrol()}>
          {picked.size ? `Enrol ${picked.size} selected` : "Enrol selected"}
        </button>
      </p>
    </div>
  );
}
