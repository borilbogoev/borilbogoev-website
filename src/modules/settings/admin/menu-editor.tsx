"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, Toggle, useConfirm, useToast } from "@/modules/forms/admin/ui";
import { PAGE_ITEMS, type MenuEntry } from "../lib/menu-model";
import "./settings-admin.css";

const newId = () => `l-${Math.random().toString(36).slice(2, 10)}`;

export function MenuEditor({ initial, schoolListed }: { initial: MenuEntry[]; schoolListed: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [saved, setSaved] = useState(initial);
  const [menu, setMenu] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(menu) !== JSON.stringify(saved);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const patch = (id: string, p: Partial<MenuEntry>) => setMenu((m) => m.map((e) => (e.id === id ? ({ ...e, ...p } as MenuEntry) : e)));
  const move = (i: number, dir: -1 | 1) =>
    setMenu((m) => {
      const j = i + dir;
      if (j < 0 || j >= m.length) return m;
      const next = [...m];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      const res = await api<{ menu: MenuEntry[] }>("settings/menu", { method: "PUT", body: { menu } });
      setSaved(res.menu);
      setMenu(res.menu);
      toast("Menu saved. The site updates within a few seconds.");
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Something went wrong", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bbs-menu">
      <p className="bbfa-muted" style={{ maxWidth: 640 }}>
        The items of the main menu, in the order they appear. Switch a page off to hide it from the menu: the page itself stays online. Links go anywhere and can be created, edited, deleted and moved. Changes go live when you save.
      </p>
      <ul className="bbs-list">
        {menu.map((e, i) => (
          <li key={e.id} className={e.enabled ? "" : "is-off"}>
            <div className="bbs-main">
              {e.type === "page" ? (
                <>
                  <div className="bbs-title">
                    <strong>{PAGE_ITEMS[e.key].label}</strong>
                    <span className="bbs-tag">Page</span>
                  </div>
                  <small className="bbfa-muted">
                    {PAGE_ITEMS[e.key].href}
                    {e.key === "school" && !schoolListed ? " · hidden by SCHOOL_LISTED=false in Vercel, whatever is set here" : ""}
                  </small>
                </>
              ) : (
                <div className="bbs-fields">
                  <div className="bbs-title">
                    <span className="bbs-tag is-link">Link</span>
                  </div>
                  <div className="bbfa-ctl">
                    <label className="bbfa-label">Title</label>
                    <input type="text" maxLength={60} value={e.title} onChange={(ev) => patch(e.id, { title: ev.target.value })} placeholder="Shown in the menu" />
                  </div>
                  <div className="bbfa-ctl">
                    <label className="bbfa-label">URL</label>
                    <input type="text" value={e.url} onChange={(ev) => patch(e.id, { url: ev.target.value })} placeholder="/pricing or https://example.com" />
                  </div>
                  <div className="bbfa-ctl">
                    <label className="bbfa-label">Target</label>
                    <select value={e.target} onChange={(ev) => patch(e.id, { target: ev.target.value === "_blank" ? "_blank" : "_self" })}>
                      <option value="_self">Same tab</option>
                      <option value="_blank">New tab</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="bbs-side">
              <Toggle label={e.enabled ? "On" : "Off"} checked={e.enabled} onChange={(v) => patch(e.id, { enabled: v })} />
              <div className="bbp-actions">
                <button type="button" className="bbfa-mini" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${e.type === "page" ? PAGE_ITEMS[e.key].label : e.title || "link"} up`}>
                  Up
                </button>
                <button type="button" className="bbfa-mini" disabled={i === menu.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${e.type === "page" ? PAGE_ITEMS[e.key].label : e.title || "link"} down`}>
                  Down
                </button>
                {e.type === "link" ? (
                  <button
                    type="button"
                    className="bbfa-mini is-danger"
                    onClick={async () => {
                      if (await confirm(`Delete the link "${e.title || "untitled"}"? It disappears from the menu when you save.`, "Delete link")) setMenu((m) => m.filter((x) => x.id !== e.id));
                    }}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="bbs-bar">
        <button type="button" className="bbfa-mini" onClick={() => setMenu((m) => [...m, { id: newId(), type: "link", title: "", url: "", target: "_self", enabled: true }])}>
          Add link
        </button>
        <span style={{ flex: 1 }} />
        {dirty ? <span className="bbfa-muted">Unsaved changes</span> : null}
        {dirty ? (
          <button type="button" className="bbfa-mini" onClick={() => setMenu(saved)} disabled={saving}>
            Discard
          </button>
        ) : null}
        <button type="button" className="bbfa-btn" onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving..." : "Save menu"}
        </button>
      </div>
    </div>
  );
}
