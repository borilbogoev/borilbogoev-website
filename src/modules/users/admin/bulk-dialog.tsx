"use client";

import { useState } from "react";
import { api, ApiError, Modal, useToast } from "@/modules/forms/admin/ui";
import { ROLE_LABELS, type Role } from "@/modules/auth/roles";
import { EXPORT_COLUMNS, type Scope } from "../lib/filter";
import type { FilterOptions } from "../server/query";

export type Group = "tags" | "courses" | "communities" | "account" | "export";
export type ScopeInfo = { scope: Scope; count: number; label: string };
export type BulkOutcome = { matched: number; affected: number; skipped: number; message: string };

/** Posts a bulk action and shows the result. Throws nothing: errors become a toast. */
export async function postBulk(scope: Scope, body: Record<string, unknown>): Promise<BulkOutcome | null> {
  return api<BulkOutcome>("users/bulk", { method: "POST", body: { scope, ...body } });
}

async function downloadCsv(scope: Scope, columns: string[]): Promise<number> {
  const res = await fetch("/api/admin/users/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, columns }), credentials: "same-origin" });
  if (!res.ok) throw new ApiError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Export failed.", res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "users.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return Number(res.headers.get("X-Rows") ?? 0);
}

type Props = { group: Group; target: ScopeInfo; options: FilterOptions; roles: Role[]; defaultMode?: string; onClose: () => void; onDone: () => void };

export function BulkDialog({ group, target, options, roles, defaultMode, onClose, onDone }: Props) {
  const toast = useToast();
  const [mode, setMode] = useState(defaultMode ?? { tags: "tag_add", courses: "course_add", communities: "community_add", account: "password_reset", export: "export" }[group]);
  const [tagId, setTagId] = useState<string>(options.tags[0] ? String(options.tags[0].id) : "new");
  const [newTag, setNewTag] = useState("");
  const [courseId, setCourseId] = useState(options.courses[0] ? String(options.courses[0].id) : "");
  const [communityId, setCommunityId] = useState(options.communities[0] ? String(options.communities[0].id) : "");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>(roles[roles.length - 1] ?? "viewer");
  const [typed, setTyped] = useState("");
  const [cols, setCols] = useState<string[]>(EXPORT_COLUMNS.filter((c) => c.on).map((c) => c.key));
  const [busy, setBusy] = useState(false);

  const body = (): Record<string, unknown> | string => {
    switch (mode) {
      case "tag_add":
        return tagId === "new" ? (newTag.trim() ? { action: mode, newTag } : "Type a name for the new tag.") : { action: mode, tagId: Number(tagId) };
      case "tag_remove":
        return tagId === "new" ? "Choose a tag." : { action: mode, tagId: Number(tagId) };
      case "course_add":
      case "course_remove":
        return courseId ? { action: mode, courseId: Number(courseId), note } : "Choose a course.";
      case "community_add":
      case "community_remove":
      case "community_ban":
      case "community_unban":
        return communityId ? { action: mode, communityId: Number(communityId), reason } : "Choose a community.";
      case "password_reset":
        return password.length >= 10 ? { action: mode, password } : "The password needs at least 10 characters.";
      case "role_set":
        return { action: mode, role };
      case "delete":
        return typed === "DELETE" ? { action: mode } : "Type DELETE to confirm.";
      default:
        return { action: mode };
    }
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "export") {
      if (!cols.length) return toast("Choose at least one column.", "error");
      setBusy(true);
      try {
        const n = await downloadCsv(target.scope, cols);
        toast(`Exported ${n} ${n === 1 ? "user" : "users"}.`);
        onClose();
      } catch (err) {
        toast(err instanceof ApiError ? err.message : "Export failed.", "error");
      } finally {
        setBusy(false);
      }
      return;
    }
    const b = body();
    if (typeof b === "string") return toast(b, "error");
    setBusy(true);
    try {
      const r = await postBulk(target.scope, b);
      toast(r ? `${r.message}${r.skipped ? ` ${r.skipped} skipped (your own account, or people you cannot manage).` : ""}` : "Done.");
      onDone();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Something went wrong.", "error");
      setBusy(false);
    }
  }

  const radio = (value: string, label: string) => (
    <label className="bbu-opt">
      <input type="radio" name="mode" checked={mode === value} onChange={() => setMode(value)} />
      {label}
    </label>
  );
  const select = (value: string, set: (v: string) => void, items: { id: number; label: string }[], aria: string, extra?: React.ReactNode) => (
    <select value={value} onChange={(e) => set(e.target.value)} aria-label={aria}>
      {extra}
      {items.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
  const title = { tags: "Tags", courses: "Courses", communities: "Communities", account: "Account", export: "Export to CSV" }[group];

  return (
    <Modal onClose={onClose}>
      <form className="bbu-dialog" onSubmit={submit}>
        <div>
          <div className="bbfa-eyebrow">{title}</div>
          <h3>{target.label}</h3>
        </div>

        {group === "tags" ? (
          <>
            <fieldset>
              {radio("tag_add", "Add to a tag (group, segment)")}
              {radio("tag_remove", "Remove from a tag")}
            </fieldset>
            {select(tagId, setTagId, options.tags.map((t) => ({ id: t.id, label: `${t.label} (${t.count})` })), "Tag", mode === "tag_add" ? <option value="new">New tag...</option> : null)}
            {mode === "tag_add" && tagId === "new" ? <input type="text" placeholder="Name of the new tag" value={newTag} maxLength={60} onChange={(e) => setNewTag(e.target.value)} autoFocus /> : null}
            <p className="bbu-note">A person can have any number of tags. Adding twice changes nothing.</p>
          </>
        ) : null}

        {group === "courses" ? (
          <>
            <fieldset>
              {radio("course_add", "Enrol in a course (access opens at once, no email is sent)")}
              {radio("course_remove", "Remove course access (progress is kept)")}
            </fieldset>
            {select(courseId, setCourseId, options.courses, "Course")}
            {mode === "course_add" ? <input type="text" placeholder="Note (optional)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /> : null}
          </>
        ) : null}

        {group === "communities" ? (
          <>
            <fieldset>
              {radio("community_add", "Add to a community")}
              {radio("community_remove", "Remove from a community")}
              {radio("community_ban", "Ban from a community")}
              {radio("community_unban", "Lift the ban in a community")}
            </fieldset>
            {select(communityId, setCommunityId, options.communities, "Community")}
            {mode === "community_ban" ? <input type="text" placeholder="Reason (optional)" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} /> : null}
          </>
        ) : null}

        {group === "account" ? (
          <>
            <fieldset>
              {radio("password_reset", "Reset the password")}
              {radio("ban", "Ban the account (cannot sign in, signed out at once)")}
              {radio("unban", "Enable the account again")}
              {radio("signout", "Sign out everywhere")}
              {radio("role_set", "Change the role")}
              {radio("delete", "Delete the accounts for good")}
            </fieldset>
            {mode === "password_reset" ? (
              <>
                <input type="password" placeholder="New password (min. 10 characters)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
                <p className="bbu-note">Everyone gets this password and is signed out everywhere. Up to 300 people at a time.</p>
              </>
            ) : null}
            {mode === "role_set" ? (
              <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            ) : null}
            {mode === "delete" ? (
              <>
                <p className="bbu-warn">This cannot be undone. Enrolments, memberships, posts and notes of these people are deleted with them.</p>
                <input type="text" placeholder="Type DELETE" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
              </>
            ) : null}
            <p className="bbu-note">Your own account and people above your role are always skipped.</p>
          </>
        ) : null}

        {group === "export" ? (
          <>
            <div className="bbu-cols">
              {EXPORT_COLUMNS.map((c) => (
                <label key={c.key} className="bbu-opt">
                  <input type="checkbox" checked={cols.includes(c.key)} onChange={(e) => setCols(e.target.checked ? [...cols, c.key] : cols.filter((k) => k !== c.key))} />
                  {c.label}
                </label>
              ))}
            </div>
            <div className="bbu-actions">
              <button type="button" className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => setCols(EXPORT_COLUMNS.map((c) => c.key))}>
                All columns
              </button>
              <button type="button" className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => setCols([])}>
                None
              </button>
            </div>
          </>
        ) : null}

        <div className="bbu-actions">
          <button type="submit" className={`bbfa-btn${busy ? " is-loading" : ""}`} disabled={busy || (mode === "delete" && typed !== "DELETE")}>
            {group === "export" ? "Download CSV" : mode === "delete" ? "Delete" : "Apply"}
          </button>
          <button type="button" className="bbfa-btn bbfa-btn--ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
