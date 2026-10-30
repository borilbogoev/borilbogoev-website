"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, Card, SelectField, TextField, Toggle, useConfirm, useFormatters, useToast } from "@/modules/forms/admin/ui";
import { StatusPill } from "./tabs";
import "@/modules/landing/admin/landing-admin.css";
import "./school-admin.css";

export type EnrolRow = {
  id: number;
  userEmail: string;
  userName: string;
  userRole: string;
  userStatus: string;
  courseId: number;
  courseTitle: string;
  status: string;
  source: string;
  reference: string;
  amountLabel: string;
  paidAt: string | null;
  note: string;
  createdAt: string;
  completed: number;
  lessons: number;
};

type Props = { rows: EnrolRow[]; courses: { id: number; title: string; access: string }[]; filters: { course: string; status: string; q: string }; canEnrol: boolean; between?: React.ReactNode };

export function StudentsManager({ rows, courses, filters, canEnrol, between }: Props) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const f = useFormatters();
  const [busy, setBusy] = useState(false);
  const [add, setAdd] = useState({ email: "", name: "", courseId: filters.course || (courses[0] ? String(courses[0].id) : ""), paid: false, note: "" });

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      const res = (await fn()) as { mail?: { sent: boolean; error?: string } } | undefined;
      if (res?.mail && !res.mail.sent) toast(`${ok}, but the email to the student was not sent: ${res.mail.error ?? "unknown error"}`, "error");
      else toast(res?.mail?.sent ? `${ok}. The student was emailed.` : ok);
      router.refresh();
      return true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Something went wrong", "error");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const patch = (id: number, body: Record<string, unknown>, ok: string) => run(() => api(`school/enrolments/${id}`, { method: "PATCH", body }), ok);

  return (
    <div>
      <form method="get" className="bbc-filters">
        <input type="search" name="q" defaultValue={filters.q} placeholder="Search name or email..." aria-label="Search" />
        <select name="course" defaultValue={filters.course} aria-label="Course">
          <option value="">Any course</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={filters.status} aria-label="Status">
          <option value="">Any status</option>
          <option value="pending">Awaiting payment</option>
          <option value="active">Active</option>
          <option value="revoked">Removed</option>
        </select>
        <button type="submit" className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm">
          Filter
        </button>
        {filters.course || filters.status || filters.q ? <Link href="/admin/school/students">Clear</Link> : null}
      </form>

      {rows.length ? (
        <div className="bbfa-table-wrap" aria-busy={busy}>
          <table className="bbfa-table bbfa-forms">
            <thead>
              <tr>
                <th>Student</th>
                <th>Course</th>
                <th>Status</th>
                <th>Payment</th>
                <th className="num">Progress</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.userName || r.userEmail}</strong>
                    <div className="bbfa-sub">
                      {r.userName ? `${r.userEmail} · ` : ""}
                      {r.userRole === "student" ? "Student" : r.userRole}
                      {r.userStatus !== "active" ? " · account disabled" : ""}
                    </div>
                  </td>
                  <td>
                    <Link href={`/admin/school/${r.courseId}/builder`}>{r.courseTitle}</Link>
                    <div className="bbfa-sub">
                      {r.source === "admin" ? "Added by an admin" : "Enrolled themselves"} · {f.ago(r.createdAt)}
                    </div>
                  </td>
                  <td>
                    <StatusPill status={r.status} />
                  </td>
                  <td>
                    <div className="bbc-pay">
                      <span>{r.amountLabel}</span>
                      {r.status === "pending" ? (
                        <span>
                          Reference <strong>{r.reference}</strong>
                        </span>
                      ) : r.paidAt ? (
                        <span>Confirmed {f.ago(r.paidAt)}</span>
                      ) : null}
                      {r.note ? <span>Note: {r.note}</span> : null}
                    </div>
                  </td>
                  <td className="num">
                    {r.completed}/{r.lessons}
                  </td>
                  <td className="bbfa-row-actions">
                    {canEnrol ? (
                      <>
                        {r.status === "pending" ? (
                          <a href="#" onClick={(e) => (e.preventDefault(), void patch(r.id, { status: "active" }, "Payment confirmed, the course is open"))}>
                            Confirm payment
                          </a>
                        ) : null}
                        {r.status === "active" ? (
                          <a
                            href="#"
                            onClick={async (e) => {
                              e.preventDefault();
                              if (await confirm("Remove this student's access? Their progress and notes are kept.", "Remove access")) void patch(r.id, { status: "revoked" }, "Access removed");
                            }}
                          >
                            Remove access
                          </a>
                        ) : null}
                        {r.status === "revoked" ? (
                          <a href="#" onClick={(e) => (e.preventDefault(), void patch(r.id, { status: "active" }, "Access restored"))}>
                            Restore access
                          </a>
                        ) : null}
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            const note = window.prompt("Note for this enrolment (bank reference, discount, reason)", r.note);
                            if (note !== null) void patch(r.id, { note }, "Note saved");
                          }}
                        >
                          Note
                        </a>
                        <a
                          href="#"
                          className="is-danger"
                          onClick={async (e) => {
                            e.preventDefault();
                            if (await confirm("Delete this enrolment record? Use Remove access to keep the history.", "Delete record")) void run(() => api(`school/enrolments/${r.id}`, { method: "DELETE" }), "Record deleted");
                          }}
                        >
                          Delete
                        </a>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bbfa-empty">
          <div className="bbfa-empty__icon">
            B<i>*</i>
          </div>
          <h3>No students match.</h3>
          <p>Students appear here when they enrol, or when you add them below. Accounts and roles live in Users.</p>
        </div>
      )}

      {between}

      {canEnrol && courses.length ? (
        <form
          className="bbc-new"
          style={{ marginTop: 32 }}
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => api("school/students", { method: "POST", body: { ...add, courseId: Number(add.courseId) } }), "Student added")) setAdd({ ...add, email: "", name: "", note: "", paid: false });
          }}
        >
          <Card eyebrow="Add a student" title="Enrol someone by email" desc="A person without an account gets a student account. They sign in with an emailed link or Google. A person who already has an account keeps their role.">
            <TextField label="Email" type="email" value={add.email} onChange={(v) => setAdd({ ...add, email: v })} />
            <TextField label="Name (optional)" value={add.name} onChange={(v) => setAdd({ ...add, name: v })} />
            <SelectField label="Course" value={add.courseId} onChange={(v) => setAdd({ ...add, courseId: v })} choices={Object.fromEntries(courses.map((c) => [String(c.id), c.title]))} />
            <TextField label="Note (optional)" value={add.note} onChange={(v) => setAdd({ ...add, note: v })} placeholder="Bank reference, discount, reason" />
            <div className="bbfa-field bbfa-field--wide">
              <Toggle label="Mark as paid" checked={add.paid} onChange={(v) => setAdd({ ...add, paid: v })} help="Records today as the payment date. Leave off for a free seat." />
            </div>
          </Card>
          <p>
            <button type="submit" className="bbfa-btn" disabled={!add.email.trim() || busy}>
              Add student
            </button>
          </p>
        </form>
      ) : null}
    </div>
  );
}
