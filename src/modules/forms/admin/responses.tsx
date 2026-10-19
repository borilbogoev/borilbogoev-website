"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AnswerValue, ResponseRecord, Values } from "../lib/responses";
import { api, ApiError, fmtDuration, fmtNum, Icon, Modal, RangePicker, useConfirm, useFormatters, useToast, type Range } from "./ui";

/** A form field as the responses table sees it. */
export type FieldInfo = {
  key: string;
  label: string;
  type: string;
  subtype: string;
  numeric: boolean;
  options: string[];
  multiple: boolean;
};

type Props = { formId: number; fields: FieldInfo[]; canWrite: boolean; canDelete: boolean; canExport: boolean; openId: number };

const asText = (v: AnswerValue | undefined) => (Array.isArray(v) ? v.join(", ") : v === undefined || v === null ? "" : String(v));
const isFile = (t: string) => t === "file";

export function Responses({ formId, fields, canWrite, canDelete, canExport, openId }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const f = useFormatters();
  const [range, setRange] = useState<Range>({ preset: "all", from: "", to: "" });
  const [perPage, setPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [orderby, setOrderby] = useState("id");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [items, setItems] = useState<ResponseRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [viewId, setViewId] = useState<number | null>(openId || null);
  const [editing, setEditing] = useState<ResponseRecord | "new" | null>(null);
  const seqLoad = useRef(0);

  // Remembered page size; read after the first paint so server and browser render the same HTML.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const saved = Number(localStorage.getItem("bbf_per_page"));
        if (saved) setPerPage(saved);
      } catch {
        // storage can be blocked
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const query = useMemo(() => ({ page, per_page: perPage, orderby, order, search, from: range.from, to: range.to, filters: Object.keys(filters).length ? filters : "" }), [page, perPage, orderby, order, search, range.from, range.to, filters]);

  const load = useCallback(async () => {
    const my = ++seqLoad.current;
    setLoading(true);
    try {
      const res = await api<{ items: ResponseRecord[]; total: number }>(`forms/${formId}/responses`, { query });
      if (my !== seqLoad.current) return;
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load responses", "error");
    } finally {
      if (my === seqLoad.current) setLoading(false);
    }
  }, [formId, query, toast]);

  // Debounced reload when the query changes (search and filter typing).
  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const markSeen = useCallback((id: number) => setItems((cur) => cur.map((r) => (r.id === id ? { ...r, is_read: true } : r))), []);
  const pages = Math.max(1, Math.ceil(total / perPage));
  const allSelected = items.length > 0 && items.every((r) => selected.has(r.id));

  const cols = [
    { key: "seq", label: "#", sort: "seq", cls: "num is-seq" },
    { key: "created_at", label: "Submitted", sort: "created_at", cls: "" },
    ...fields.map((x) => ({ key: x.key, label: x.label, sort: `f:${x.key}`, cls: "", field: x })),
    { key: "channel", label: "Source", sort: "channel", cls: "" },
    { key: "device", label: "Device", sort: "device", cls: "" },
  ];

  const exportCsv = () => {
    const url = new URL(`/api/admin/forms/${formId}/export`, window.location.origin);
    for (const [k, v] of Object.entries(query)) if (v !== "" && !["page", "per_page"].includes(k)) url.searchParams.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    window.location.href = url.toString();
    toast(`Preparing CSV of ${fmtNum(total)} responses...`);
  };

  const removeSelected = async () => {
    const ids = [...selected];
    if (!(await confirm(`Delete ${ids.length} response(s)? This cannot be undone.`))) return;
    try {
      const r = await api<{ deleted: number }>(`forms/${formId}/responses/delete`, { method: "POST", body: { ids } });
      toast(`${r.deleted} deleted`);
      setSelected(new Set());
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  };

  const markRead = async () => {
    await Promise.all([...selected].map((id) => api(`forms/responses/${id}/read`, { method: "POST", body: { read: 1 } })));
    void load();
  };

  const cell = (fld: FieldInfo, v: AnswerValue | undefined): ReactNode => {
    const t = asText(v);
    if (t === "") return <span className="bbfa-muted">–</span>;
    if (isFile(fld.type))
      return (
        <a href={t} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          <Icon name="download" /> file
        </a>
      );
    if (fld.type === "rating")
      return (
        <span className="bbfa-stars">
          ★ <b>{t}</b>/{fld.options.length}
        </span>
      );
    if (Array.isArray(v))
      return (
        <span className="bbfa-pills">
          {v.slice(0, 3).map((x) => (
            <span key={x}>{x}</span>
          ))}
          {v.length > 3 ? <span>+{v.length - 3}</span> : null}
        </span>
      );
    if (fld.type === "consent") return <span className={`bbfa-yn is-${t === "Yes" ? "yes" : "no"}`}>{t}</span>;
    return (
      <span className="bbfa-cell-text" title={t.length > 60 ? t : undefined}>
        {t.length > 60 ? `${t.slice(0, 57)}...` : t}
      </span>
    );
  };

  return (
    <div className="bbfa-section">
      <div className="bbfa-section__head">
        <div>
          <div className="bbfa-eyebrow">Inbox</div>
          <h2>Responses</h2>
        </div>
      </div>

      <div className="bbfa-toolbar">
        <RangePicker
          value={range}
          onChange={(r) => {
            setRange(r);
            setPage(1);
          }}
        />
        <div className="bbfa-search is-inline">
          <Icon name="search" />
          <input
            type="search"
            placeholder="Search responses or #ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <button type="button" className={`bbfa-btn bbfa-btn--ghost bbfa-btn--sm${showFilters ? " is-on" : ""}`} onClick={() => setShowFilters((s) => !s)}>
          <Icon name="filter" /> Filters
        </button>
        <select
          aria-label="Rows per page"
          value={perPage}
          onChange={(e) => {
            const n = Number(e.target.value);
            setPerPage(n);
            setPage(1);
            try {
              localStorage.setItem("bbf_per_page", String(n));
            } catch {
              // ignore
            }
          }}
        >
          {[10, 25, 50, 100, 250].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
        <span className="bbfa-spacer" />
        {canExport ? (
          <button type="button" className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={exportCsv}>
            <Icon name="download" /> Export CSV
          </button>
        ) : null}
        {canWrite ? (
          <button type="button" className="bbfa-btn bbfa-btn--sm" onClick={() => setEditing("new")}>
            <Icon name="plus" /> Add record
          </button>
        ) : null}
      </div>

      {selected.size ? (
        <div className="bbfa-bulkbar">
          <strong>{selected.size} selected</strong>
          {canWrite ? (
            <button type="button" className="bbfa-mini is-ghost" onClick={markRead}>
              Mark as read
            </button>
          ) : null}
          <button type="button" className="bbfa-mini is-ghost" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
          {canDelete ? (
            <button type="button" className="bbfa-mini is-danger" onClick={removeSelected}>
              <Icon name="trash" /> Delete
            </button>
          ) : null}
        </div>
      ) : null}

      <div className={`bbfa-table-wrap${loading ? " is-loading" : ""}`}>
        <table className={`bbfa-table bbfa-resp${loading ? " is-loading" : ""}`}>
          <thead>
            <tr>
              <th className="is-check">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allSelected}
                  onChange={(e) => setSelected(e.target.checked ? new Set(items.map((r) => r.id)) : new Set())}
                />
              </th>
              {cols.map((c) => {
                const active = orderby === c.sort;
                return (
                  <th
                    key={c.key}
                    className={`${c.cls} is-sortable${active ? ` is-sorted is-${order}` : ""}`}
                    title={"field" in c ? c.field.key : undefined}
                    onClick={() => {
                      if (orderby === c.sort) setOrder(order === "asc" ? "desc" : "asc");
                      else {
                        setOrderby(c.sort);
                        setOrder(c.key === "created_at" || c.key === "seq" ? "desc" : "asc");
                      }
                      setPage(1);
                    }}
                  >
                    <span>{c.label}</span>
                    <i className="bbfa-sort" />
                  </th>
                );
              })}
            </tr>
            {showFilters ? (
              <tr className="bbfa-filter-row">
                <th />
                {cols.map((c) => {
                  if (c.key === "seq" || c.key === "created_at") return <th key={c.key} />;
                  const fld = "field" in c ? c.field : null;
                  const set = (val: string) => {
                    setFilters((cur) => {
                      const next = { ...cur };
                      if (val) next[c.key] = val;
                      else delete next[c.key];
                      return next;
                    });
                    setPage(1);
                  };
                  return (
                    <th key={c.key}>
                      {fld && fld.options.length > 0 && fld.options.length < 30 ? (
                        <select value={filters[c.key] ?? ""} onChange={(e) => set(e.target.value)}>
                          <option value="">All</option>
                          {fld.options.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : c.key === "device" ? (
                        <select value={filters.device ?? ""} onChange={(e) => set(e.target.value)}>
                          {["", "desktop", "mobile", "tablet"].map((o) => (
                            <option key={o} value={o}>
                              {o || "All"}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input type="text" placeholder="Filter..." value={filters[c.key] ?? ""} onChange={(e) => set(e.target.value)} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ) : null}
          </thead>
          <tbody>
            {!items.length ? (
              <tr>
                <td colSpan={cols.length + 1} className="bbfa-table-empty">
                  <div>
                    <Icon name="inbox" />
                    <strong>{loading ? "Loading..." : "No responses found"}</strong>
                    <p>{loading ? "" : "Try a wider date range or clear filters."}</p>
                  </div>
                </td>
              </tr>
            ) : null}
            {items.map((r) => (
              <tr key={r.id} className={`${r.is_read ? "" : "is-unread"}${selected.has(r.id) ? " is-selected" : ""}`} tabIndex={0} onClick={() => setViewId(r.id)} onKeyDown={(e) => e.key === "Enter" && setViewId(r.id)}>
                <td className="is-check" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label="Select"
                    checked={selected.has(r.id)}
                    onChange={(e) =>
                      setSelected((cur) => {
                        const n = new Set(cur);
                        if (e.target.checked) n.add(r.id);
                        else n.delete(r.id);
                        return n;
                      })
                    }
                  />
                </td>
                {cols.map((c) => {
                  if (c.key === "seq")
                    return (
                      <td key={c.key} className="num is-seq">
                        {r.is_read ? null : <i className="bbfa-unread-dot" />}#{r.seq}
                      </td>
                    );
                  if (c.key === "created_at")
                    return (
                      <td key={c.key} className="is-date">
                        {f.dateTime(r.created_at)}
                      </td>
                    );
                  if (c.key === "channel")
                    return (
                      <td key={c.key}>
                        <span className="bbfa-chip">{r.origin === "admin" ? "manual" : r.channel}</span>
                      </td>
                    );
                  if (c.key === "device")
                    return (
                      <td key={c.key} className="is-muted">
                        {r.device || "–"}
                      </td>
                    );
                  return <td key={c.key}>{"field" in c ? cell(c.field, r.values[c.key]) : null}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bbfa-table-foot">
        <div className="bbfa-muted">
          Showing{" "}
          <b>
            {total ? (page - 1) * perPage + 1 : 0}–{Math.min(total, page * perPage)}
          </b>{" "}
          of <b>{fmtNum(total)}</b> responses
        </div>
        <Pager page={page} pages={pages} onGo={setPage} />
      </div>

      {viewId !== null ? (
        <RecordView
          key="view"
          id={viewId}
          fields={fields}
          items={items}
          canWrite={canWrite}
          canDelete={canDelete}
          onClose={() => setViewId(null)}
          onNavigate={setViewId}
          onSeen={markSeen}
          onEdit={(r) => {
            setViewId(null);
            setEditing(r);
          }}
          onDeleted={() => {
            setViewId(null);
            void load();
          }}
        />
      ) : null}
      {editing ? (
        <RecordEditor
          formId={formId}
          fields={fields}
          record={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(id) => {
            setEditing(null);
            void load().then(() => setViewId(id));
          }}
          onCancelEdit={(r) => {
            setEditing(null);
            if (r) setViewId(r.id);
          }}
        />
      ) : null}
    </div>
  );
}

function Pager({ page, pages, onGo }: { page: number; pages: number; onGo: (p: number) => void }) {
  const list: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) list.push(p);
    else if (list[list.length - 1] !== "…") list.push("…");
  }
  return (
    <div className="bbfa-pager">
      <button type="button" disabled={page <= 1} aria-label="Previous page" onClick={() => onGo(page - 1)}>
        <Icon name="left" />
      </button>
      {list.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`}>…</span>
        ) : (
          <button key={p} type="button" className={p === page ? "is-active" : ""} onClick={() => onGo(p)}>
            {p}
          </button>
        ),
      )}
      <button type="button" disabled={page >= pages} aria-label="Next page" onClick={() => onGo(page + 1)}>
        <Icon name="right" />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Record view                                                                */
/* -------------------------------------------------------------------------- */

function valueView(fld: FieldInfo | null, v: AnswerValue | undefined): ReactNode {
  const t = asText(v);
  if (t === "") return <span className="bbfa-muted">No answer</span>;
  if (fld && isFile(fld.type))
    return (
      <a className="bbfa-file-link" href={t} target="_blank" rel="noopener noreferrer">
        <Icon name="download" />
        {t.split("/").pop()}
      </a>
    );
  if (fld?.type === "rating") {
    const n = Number(t);
    const max = fld.options.length;
    return (
      <span className="bbfa-rating-view">
        {Array.from({ length: max }, (_, i) => (
          <i key={i} className={i < n ? "on" : ""}>
            ★
          </i>
        ))}{" "}
        <b>
          {n}/{max}
        </b>
      </span>
    );
  }
  if (fld?.type === "scale")
    return (
      <span className="bbfa-scale-view">
        <b>{t}</b> / {fld.options[fld.options.length - 1]}
      </span>
    );
  if (Array.isArray(v))
    return (
      <span className="bbfa-pills is-lg">
        {v.map((x) => (
          <span key={x}>{x}</span>
        ))}
      </span>
    );
  if (fld && (fld.type === "email" || fld.subtype === "email")) return <a href={`mailto:${t}`}>{t}</a>;
  if (fld && (fld.type === "website" || fld.subtype === "url"))
    return (
      <a href={t} target="_blank" rel="noopener noreferrer">
        {t}
      </a>
    );
  if (fld && (fld.type === "phone" || fld.subtype === "tel")) return <a href={`tel:${t.replace(/[^0-9+]/g, "")}`}>{t}</a>;
  return <span className="bbfa-pre">{t}</span>;
}

function displayName(r: ResponseRecord) {
  const v = r.values;
  const parts = ["first_name", "last_name"].map((k) => asText(v[k])).filter(Boolean);
  if (parts.length) return parts.join(" ");
  return asText(v.name) || asText(v.email) || `Response #${r.seq}`;
}

function RecordView({
  id,
  fields,
  items,
  canWrite,
  canDelete,
  onClose,
  onNavigate,
  onSeen,
  onEdit,
  onDeleted,
}: {
  id: number;
  fields: FieldInfo[];
  items: ResponseRecord[];
  canWrite: boolean;
  canDelete: boolean;
  onClose: () => void;
  onNavigate: (id: number) => void;
  onSeen: (id: number) => void;
  onEdit: (r: ResponseRecord) => void;
  onDeleted: () => void;
}) {
  const f = useFormatters();
  const toast = useToast();
  const confirm = useConfirm();
  const [loaded, setLoaded] = useState<ResponseRecord | null>(null);
  const [error, setError] = useState("");
  const r = loaded && loaded.id === id ? loaded : null;

  useEffect(() => {
    let alive = true;
    api<ResponseRecord>(`forms/responses/${id}`)
      .then((rec) => {
        if (!alive) return;
        setLoaded(rec);
        onSeen(rec.id);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load the response"));
    return () => {
      alive = false;
    };
  }, [id, onSeen]);

  const idx = items.findIndex((x) => x.id === id);
  const step = useCallback(
    (d: number) => {
      const nx = items[idx + d];
      if (nx) onNavigate(nx.id);
    },
    [items, idx, onNavigate],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [step]);

  const known = new Set(fields.map((x) => x.key));
  return (
    <Modal wide onClose={onClose}>
      {!r ? (
        <div className="bbfa-loading">{error || "Loading..."}</div>
      ) : (
        <>
          <div className="bbfa-rec__head">
            <div>
              <div className="bbfa-eyebrow">Response #{r.seq}</div>
              <h2>
                {displayName(r)}
                <span className="bbfa-dot">.</span>
              </h2>
              <div className="bbfa-rec__chips">
                <span className="bbfa-chip is-id">ID {String(r.id).padStart(6, "0")}</span>
                <span className="bbfa-chip">{r.origin === "admin" ? "Added manually" : "Form submission"}</span>
                {r.updated_at !== r.created_at ? <span className="bbfa-chip">Edited {f.dateTime(r.updated_at)}</span> : null}
              </div>
            </div>
            <div className="bbfa-rec__time">
              <strong>{f.date(r.created_at)}</strong>
              <span>{f.time(r.created_at)}</span>
            </div>
          </div>
          <div className="bbfa-rec__meta">
            <div>
              <span>Completion time</span>
              <strong>{fmtDuration(r.duration)}</strong>
            </div>
            <div>
              <span>Source</span>
              <strong>{r.origin === "admin" ? "manual" : r.channel}</strong>
            </div>
            <div>
              <span>Device</span>
              <strong>{r.device || "–"}</strong>
            </div>
            <div>
              <span>Page</span>
              {r.page_url ? (
                <a href={r.page_url} target="_blank" rel="noopener noreferrer">
                  {r.page_url.replace(/^https?:\/\/[^/]+/, "") || "/"}
                </a>
              ) : (
                <strong>–</strong>
              )}
            </div>
            {r.user_label ? (
              <div>
                <span>Added by</span>
                <strong>{r.user_label}</strong>
              </div>
            ) : null}
            {r.ip ? (
              <div>
                <span>IP</span>
                <strong>{r.ip}</strong>
              </div>
            ) : null}
            {typeof r.meta?.utm_campaign === "string" ? (
              <div>
                <span>Campaign</span>
                <strong>{r.meta.utm_campaign}</strong>
              </div>
            ) : null}
          </div>
          <div className="bbfa-rec__answers">
            {fields.map((fld, i) => (
              <div className="bbfa-ans" key={fld.key}>
                <div className="bbfa-ans__q">
                  <span className="bbfa-ans__n">{String(i + 1).padStart(2, "0")}</span>
                  <span>{fld.label}</span>
                  <code>{fld.key}</code>
                </div>
                <div className="bbfa-ans__a">{valueView(fld, r.values[fld.key])}</div>
              </div>
            ))}
            {Object.keys(r.values)
              .filter((k) => !known.has(k))
              .map((k) => (
                <div className="bbfa-ans is-orphan" key={k}>
                  <div className="bbfa-ans__q">
                    <span className="bbfa-ans__n">–</span>
                    <span>Removed field</span>
                    <code>{k}</code>
                  </div>
                  <div className="bbfa-ans__a">{valueView(null, r.values[k])}</div>
                </div>
              ))}
          </div>
          <div className="bbfa-rec__foot">
            {canDelete ? (
              <button
                type="button"
                className="bbfa-btn bbfa-btn--ghost bbfa-btn--danger-ghost"
                onClick={async () => {
                  if (!(await confirm(`Delete response #${r.seq}? This cannot be undone.`))) return;
                  try {
                    await api(`forms/responses/${r.id}`, { method: "DELETE" });
                    toast("Response deleted");
                    onDeleted();
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Delete failed", "error");
                  }
                }}
              >
                <Icon name="trash" /> Delete
              </button>
            ) : null}
            <span className="bbfa-spacer" />
            <button type="button" className="bbfa-icon-btn" title="Previous (←)" disabled={idx <= 0} onClick={() => step(-1)}>
              <Icon name="left" />
            </button>
            <button type="button" className="bbfa-icon-btn" title="Next (→)" disabled={idx < 0 || idx >= items.length - 1} onClick={() => step(1)}>
              <Icon name="right" />
            </button>
            {canWrite ? (
              <button type="button" className="bbfa-btn" onClick={() => onEdit(r)}>
                <Icon name="edit" /> Edit data
              </button>
            ) : null}
          </div>
        </>
      )}
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Record editor                                                              */
/* -------------------------------------------------------------------------- */

function RecordEditor({ formId, fields, record, onClose, onSaved, onCancelEdit }: { formId: number; fields: FieldInfo[]; record: ResponseRecord | null; onClose: () => void; onSaved: (id: number) => void; onCancelEdit: (r: ResponseRecord | null) => void }) {
  const f = useFormatters();
  const toast = useToast();
  const isNew = !record;
  const [when, setWhen] = useState(() => f.local(record ? record.created_at : new Date().toISOString()));
  const [values, setValues] = useState<Values>(() => ({ ...(record?.values ?? {}) }));
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: AnswerValue) => setValues((cur) => ({ ...cur, [k]: v }));

  const submit = async () => {
    setBusy(true);
    try {
      // datetime-local has no zone: it is in the forms time zone, so send it with that zone's offset.
      const iso = zonedToIso(when, f.local);
      const body = { values, created_at: iso };
      const res = isNew ? await api<ResponseRecord>(`forms/${formId}/responses`, { method: "POST", body }) : await api<ResponseRecord>(`forms/responses/${record.id}`, { method: "PUT", body });
      toast(isNew ? "Record added" : "Changes saved");
      onSaved(res.id);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Save failed", "error");
      setBusy(false);
    }
  };

  return (
    <Modal wide onClose={onClose}>
      <div className="bbfa-rec__head">
        <div>
          <div className="bbfa-eyebrow">{isNew ? "New record" : `Edit response #${record.seq}`}</div>
          <h2>
            {isNew ? "Add record" : "Edit data"}
            <span className="bbfa-dot">.</span>
          </h2>
          {isNew ? <p className="bbfa-muted">Manually added records are marked as &quot;manual&quot; and skip validation and notifications.</p> : null}
        </div>
      </div>
      <form
        className="bbfa-rec__edit"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="bbfa-field">
          <span className="bbfa-label">Submitted at</span>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
        {fields.map((fld) => (
          <label key={fld.key} className={`bbfa-field${fld.type === "long_text" || (fld.type === "choice" && fld.multiple) ? " bbfa-field--wide" : ""}`}>
            <span className="bbfa-label">
              {fld.label} <code>{fld.key}</code>
            </span>
            <EditorInput fld={fld} value={values[fld.key]} onChange={(v) => set(fld.key, v)} />
          </label>
        ))}
      </form>
      <div className="bbfa-rec__foot">
        <span className="bbfa-spacer" />
        <button type="button" className="bbfa-btn bbfa-btn--ghost" onClick={() => onCancelEdit(record)}>
          Cancel
        </button>
        <button type="button" className={`bbfa-btn${busy ? " is-loading" : ""}`} onClick={submit}>
          {isNew ? "Add record" : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}

/** Reads a "YYYY-MM-DDTHH:mm" value that is in the forms time zone and returns the matching instant. */
function zonedToIso(local: string, toLocal: (iso: string) => string): string {
  const guess = new Date(`${local}:00Z`);
  if (Number.isNaN(guess.getTime())) return new Date().toISOString();
  // Move the guess by the difference between what the zone shows for it and what was typed.
  const shown = new Date(`${toLocal(guess.toISOString())}:00Z`);
  return new Date(guess.getTime() - (shown.getTime() - guess.getTime())).toISOString();
}

function EditorInput({ fld, value, onChange }: { fld: FieldInfo; value: AnswerValue | undefined; onChange: (v: AnswerValue) => void }) {
  const t = asText(value);
  if (fld.type === "choice" && fld.multiple) {
    const vals = Array.isArray(value) ? value : t ? [t] : [];
    const extras = vals.filter((x) => !fld.options.includes(x));
    return (
      <span className="bbfa-edit-checks">
        {[...fld.options, ...extras].map((o) => (
          <label key={o}>
            <input type="checkbox" checked={vals.includes(o)} onChange={(e) => onChange(e.target.checked ? [...vals, o] : vals.filter((x) => x !== o))} />
            <span>{o}</span>
          </label>
        ))}
      </span>
    );
  }
  if (fld.options.length) {
    const opts = t && !fld.options.includes(t) ? [...fld.options, t] : fld.options;
    return (
      <select value={t} onChange={(e) => onChange(e.target.value)}>
        <option value="">–</option>
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (fld.type === "long_text") return <textarea rows={4} value={t} onChange={(e) => onChange(e.target.value)} />;
  const types: Record<string, string> = { email: "email", number: "number", date: "date", website: "url", phone: "tel" };
  return <input type={types[fld.type] ?? (fld.subtype === "email" ? "email" : "text")} step={fld.type === "number" ? "any" : undefined} value={t} onChange={(e) => onChange(e.target.value)} />;
}
