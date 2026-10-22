"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, CopyCode, fmtNum, useConfirm, useFormatters, useToast } from "@/modules/forms/admin/ui";
import { StatusPill } from "./tabs";
import "@/modules/landing/admin/landing-admin.css";
import "./classroom-admin.css";

export type CourseRow = {
  id: number;
  title: string;
  slug: string;
  status: string;
  categoryName: string;
  access: string;
  priceLabel: string;
  language: string;
  modules: number;
  lessons: number;
  students: number;
  pending: number;
  updatedAt: string;
  thumb: string;
};

export function CoursesTable({ rows, canWrite, canDelete, siteUrl }: { rows: CourseRow[]; canWrite: boolean; canDelete: boolean; siteUrl: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const f = useFormatters();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bbfa-table-wrap" aria-busy={busy}>
      <table className="bbfa-table bbfa-forms">
        <thead>
          <tr>
            <th>Course</th>
            <th>Address</th>
            <th className="num">Modules</th>
            <th className="num">Lessons</th>
            <th className="num">Students</th>
            <th>Access</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <div className="bbc-row-title">
                  {r.thumb ? <img className="bbc-thumb" src={r.thumb} alt="" /> : <span className="bbc-thumb" aria-hidden="true" />}
                  <div>
                    <Link className="bbfa-forms__title" href={`/admin/classroom/${r.id}/builder`}>
                      {r.title}
                    </Link>
                    <div className="bbfa-sub">
                      #{r.id} · updated {f.ago(r.updatedAt)}
                      {r.categoryName ? ` · ${r.categoryName}` : ""} · {r.language.toUpperCase()}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <CopyCode text={`${siteUrl}/classroom/${r.slug}`}>/classroom/{r.slug}</CopyCode>
              </td>
              <td className="num">{fmtNum(r.modules)}</td>
              <td className="num">{fmtNum(r.lessons)}</td>
              <td className="num">
                {fmtNum(r.students)}
                {r.pending ? (
                  <div>
                    <Link href={`/admin/classroom/students?course=${r.id}&status=pending`} className="bbfa-sub">
                      {r.pending} to confirm
                    </Link>
                  </div>
                ) : null}
              </td>
              <td>{r.priceLabel}</td>
              <td>
                <StatusPill status={r.status} />
              </td>
              <td className="bbfa-row-actions">
                <Link href={`/admin/classroom/${r.id}/builder`}>{canWrite ? "Build" : "View"}</Link>
                <Link href={`/admin/classroom/${r.id}/settings`}>Settings</Link>
                <Link href={`/admin/classroom/students?course=${r.id}`}>Students</Link>
                {canDelete ? (
                  <a
                    href="#"
                    className="is-danger"
                    onClick={async (e) => {
                      e.preventDefault();
                      if (await confirm("Delete this course with all its modules, lessons, enrolments, progress, notes and comments? This cannot be undone.")) void run(() => api(`classroom/courses/${r.id}`, { method: "DELETE" }), "Course deleted");
                    }}
                  >
                    Delete
                  </a>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
