"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, useConfirm, useToast } from "@/modules/forms/admin/ui";
import type { TagRow } from "../server/query";
import "./users.css";

export function TagsManager({ tags }: { tags: TagRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string; description: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      router.refresh();
      return true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Something went wrong", "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="bbfa-muted" style={{ marginTop: 0 }}>
        Tags (groups, segments) sort users. Create them here, from the checkboxes or the filter on the Users page, or on a user&apos;s own page. One person can have as many as you like.
      </p>
      <div className="bbfa-table-wrap">
        <table className="bbfa-table">
          <thead>
            <tr>
              <th>Tag</th>
              <th>Description</th>
              <th className="num">People</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tags.length ? (
              tags.map((t) => (
                <tr key={t.id}>
                  {editing?.id === t.id ? (
                    <>
                      <td>
                        <input className="bbu-inline-input" value={editing.name} maxLength={60} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label="Tag name" />
                      </td>
                      <td>
                        <input className="bbu-inline-input" value={editing.description} maxLength={300} onChange={(e) => setEditing({ ...editing, description: e.target.value })} aria-label="Description" />
                      </td>
                      <td className="num">{t.members}</td>
                      <td className="bbfa-row-actions">
                        <a
                          href="#"
                          onClick={async (e) => {
                            e.preventDefault();
                            if (await run(() => api(`users/tags/${t.id}`, { method: "PATCH", body: { name: editing.name, description: editing.description } }), "Tag saved")) setEditing(null);
                          }}
                        >
                          Save
                        </a>
                        <a href="#" onClick={(e) => (e.preventDefault(), setEditing(null))}>
                          Cancel
                        </a>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <strong>{t.name}</strong>
                        <div className="bbfa-sub">{t.slug}</div>
                      </td>
                      <td>{t.description || <span className="bbfa-muted">-</span>}</td>
                      <td className="num">{t.members}</td>
                      <td className="bbfa-row-actions">
                        <Link href={`/admin/users?tag=${t.id}`}>View people</Link>
                        <a href="#" onClick={(e) => (e.preventDefault(), setEditing({ id: t.id, name: t.name, description: t.description }))}>
                          Rename
                        </a>
                        <a
                          href="#"
                          className="is-danger"
                          onClick={async (e) => {
                            e.preventDefault();
                            if (await confirm(`Delete the tag "${t.name}"? The ${t.members} people keep their accounts, they only lose this tag.`)) void run(() => api(`users/tags/${t.id}`, { method: "DELETE" }), "Tag deleted");
                          }}
                        >
                          Delete
                        </a>
                      </td>
                    </>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="bbfa-muted" style={{ padding: 24 }}>
                  No tags yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form
        className="bbu-inline"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => api("users/tags", { method: "POST", body: { name, description } }), "Tag created")) {
            setName("");
            setDescription("");
          }
        }}
      >
        <input placeholder="New tag name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label="New tag name" />
        <input placeholder="Description (optional)" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} aria-label="Description" style={{ minWidth: 260 }} />
        <button type="submit" className="bbfa-btn bbfa-btn--sm" disabled={!name.trim() || busy}>
          Add tag
        </button>
      </form>
    </div>
  );
}
