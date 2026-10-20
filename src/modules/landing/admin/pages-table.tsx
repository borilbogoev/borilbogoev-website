"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, CopyCode, fmtNum, useConfirm, useFormatters, useToast } from "@/modules/forms/admin/ui";
import { StatusPill } from "./tabs";
import "./landing-admin.css";

export type PageRow = { id: number; title: string; slug: string; status: string; updatedAt: string; publishedAt: string | null; views: number; unique: number; clicks: number };

export function PagesTable({ rows, canWrite, canDelete, siteUrl }: { rows: PageRow[]; canWrite: boolean; canDelete: boolean; siteUrl: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const f = useFormatters();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string, fail: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : fail, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bbfa-table-wrap" aria-busy={busy}>
      <table className="bbfa-table bbfa-forms">
        <thead>
          <tr>
            <th>Page</th>
            <th>Address</th>
            <th className="num">Views</th>
            <th className="num">Unique</th>
            <th className="num">Clicks</th>
            <th className="num">CTR</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const base = `/admin/landing/${r.id}`;
            const url = `${siteUrl}/l/${r.slug}`;
            return (
              <tr key={r.id}>
                <td>
                  <Link className="bbfa-forms__title" href={`${base}/builder`}>
                    {r.title}
                  </Link>
                  <div className="bbfa-sub">
                    #{r.id} · updated {f.ago(r.updatedAt)}
                  </div>
                </td>
                <td>
                  <CopyCode text={url}>/l/{r.slug}</CopyCode>
                </td>
                <td className="num">{fmtNum(r.views)}</td>
                <td className="num">{fmtNum(r.unique)}</td>
                <td className="num">{fmtNum(r.clicks)}</td>
                <td className="num">{r.views ? `${Math.round((r.clicks / r.views) * 1000) / 10}%` : "–"}</td>
                <td>
                  <StatusPill status={r.status} />
                </td>
                <td className="bbfa-row-actions">
                  <Link href={`${base}/builder`}>{canWrite ? "Build" : "View"}</Link>
                  <Link href={`${base}/dashboard`}>Dashboard</Link>
                  {r.status === "published" ? (
                    <a href={`/l/${r.slug}`} target="_blank" rel="noopener noreferrer">
                      Open ↗
                    </a>
                  ) : (
                    <a href={`${base}/preview`} target="_blank" rel="noopener noreferrer">
                      Preview ↗
                    </a>
                  )}
                  {canWrite ? (
                    <a href="#" onClick={(e) => (e.preventDefault(), void run(() => api(`landing/${r.id}/duplicate`, { method: "POST" }), "Page duplicated", "Could not duplicate"))}>
                      Duplicate
                    </a>
                  ) : null}
                  {canDelete ? (
                    <a
                      href="#"
                      className="is-danger"
                      onClick={async (e) => {
                        e.preventDefault();
                        if (await confirm("Delete this page with its statistics? This cannot be undone.")) void run(() => api(`landing/${r.id}`, { method: "DELETE" }), "Page deleted", "Could not delete");
                      }}
                    >
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
