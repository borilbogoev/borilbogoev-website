"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formPath } from "../lib/paths";
import { api, CopyCode, fmtNum, useConfirm, useFormatters, useToast } from "./ui";

export type FormRow = { id: number; title: string; status: string; slug: string | null; updatedAt: string; responses: number; unread: number; lastResponse: string | null; views: number };

export function StatusPill({ status }: { status: string }) {
  const label: Record<string, string> = { active: "Active", draft: "Draft", closed: "Closed" };
  return <span className={`bbfa-pill bbfa-pill--${status}`}>{label[status] ?? status}</span>;
}

export function FormsTable({ rows, canWrite, canDelete }: { rows: FormRow[]; canWrite: boolean; canDelete: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const f = useFormatters();
  const [busy, setBusy] = useState(false);

  const duplicate = async (id: number) => {
    setBusy(true);
    try {
      await api(`forms/${id}/duplicate`, { method: "POST" });
      toast("Form duplicated");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not duplicate", "error");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: number) => {
    if (!(await confirm("Delete this form and ALL its responses? This cannot be undone."))) return;
    setBusy(true);
    try {
      await api(`forms/${id}`, { method: "DELETE" });
      toast("Form deleted");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bbfa-table-wrap" aria-busy={busy}>
      <table className="bbfa-table bbfa-forms">
        <thead>
          <tr>
            <th>Form</th>
            <th>Embed</th>
            <th className="num">Responses</th>
            <th className="num">Views</th>
            <th className="num">Conversion</th>
            <th>Last response</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const base = `/admin/forms/${r.id}`;
            const snippet = `<FormEmbed id={${r.id}} />`;
            return (
              <tr key={r.id}>
                <td>
                  <Link className="bbfa-forms__title" href={`${base}/builder`}>
                    {r.title}
                  </Link>
                  <div className="bbfa-sub">
                    #{r.id} · updated {f.ago(r.updatedAt)}
                    {r.slug ? ` · ${formPath(r.slug)}` : ""}
                  </div>
                </td>
                <td>
                  <CopyCode text={snippet}>{snippet}</CopyCode>
                </td>
                <td className="num">
                  <Link href={`${base}/responses`}>
                    <strong>{fmtNum(r.responses)}</strong>
                  </Link>
                  {r.unread ? <span className="bbfa-badge">{r.unread} new</span> : null}
                </td>
                <td className="num">{fmtNum(r.views)}</td>
                <td className="num">{r.views ? `${Math.round((r.responses / r.views) * 1000) / 10}%` : "–"}</td>
                <td>{r.lastResponse ? f.ago(r.lastResponse) : "–"}</td>
                <td>
                  <StatusPill status={r.status} />
                </td>
                <td className="bbfa-row-actions">
                  <Link href={`${base}/builder`}>{canWrite ? "Build" : "View"}</Link>
                  <Link href={`${base}/dashboard`}>Dashboard</Link>
                  {canWrite ? (
                    <a href="#" onClick={(e) => (e.preventDefault(), void duplicate(r.id))}>
                      Duplicate
                    </a>
                  ) : null}
                  {canDelete ? (
                    <a href="#" className="is-danger" onClick={(e) => (e.preventDefault(), void remove(r.id))}>
                      Delete
                    </a>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
