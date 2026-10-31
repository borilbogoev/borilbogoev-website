"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api, ApiError, Card, Modal, SelectField, TextField, useFormatters, useToast } from "@/modules/forms/admin/ui";
import { ROLE_HELP, ROLE_LABELS, ROLES, type Role } from "@/modules/auth/roles";
import { COURSE_STATUS_CHOICES, PAGE_SIZES, PASSWORD_CHOICES, SIGNIN_CHOICES, filterToParams, hasFilter, type ListParams, type Scope, type SortKey, type UserFilter } from "../lib/filter";
import type { FilterOptions, UserListRow } from "../server/query";
import { BulkDialog, type Group, type ScopeInfo } from "./bulk-dialog";
import "./users.css";

type Props = { rows: UserListRow[]; total: number; page: number; pages: number; params: ListParams; options: FilterOptions; me: { id: string; role: Role }; roles: Role[] };

const COLS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: "name", label: "User" },
  { key: "role", label: "Role" },
  { key: "status", label: "Status" },
  { key: "courses", label: "Courses", num: true },
  { key: "communities", label: "Communities", num: true },
  { key: "login", label: "Last sign-in" },
  { key: "created", label: "Created" },
];

export function UsersList({ rows, total, page, pages, params, options, me, roles }: Props) {
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();
  const f = useFormatters();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [dialog, setDialog] = useState<{ group: Group; mode?: string; scope: "selection" | "filter" } | null>(null);
  const [adding, setAdding] = useState(false);
  const filter = params.filter;
  const filtered = hasFilter(filter);

  const go = (patch: Partial<{ filter: UserFilter; sort: SortKey; dir: string; per: number; page: number }>) => {
    const nf = patch.filter ?? filter;
    const p = filterToParams(nf);
    const sort = patch.sort ?? params.sort;
    const dir = patch.dir ?? params.dir;
    const per = patch.per ?? params.perPage;
    if (sort !== "created" || dir !== "desc") {
      p.set("sort", sort);
      p.set("dir", dir);
    }
    if (per !== 25) p.set("per", String(per));
    const pg = patch.page ?? (patch.filter || patch.per ? 1 : page);
    if (pg > 1) p.set("page", String(pg));
    router.push(`${path}${p.size ? `?${p}` : ""}`);
  };

  const pageIds = rows.map((r) => r.id);
  const allOnPage = rows.length > 0 && pageIds.every((id) => selected.has(id));
  const count = allMatching ? total : selected.size;
  const toggleAll = () => {
    setAllMatching(false);
    setSelected(allOnPage ? new Set() : new Set(pageIds));
  };
  const toggle = (id: string) => {
    setAllMatching(false);
    const n = new Set(selected);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSelected(n);
  };
  const clear = () => {
    setSelected(new Set());
    setAllMatching(false);
  };

  const target: ScopeInfo | null = useMemo(() => {
    if (!dialog) return null;
    const matching = dialog.scope === "filter" || allMatching;
    const scope: Scope = matching ? { filter } : { ids: [...selected] };
    const n = matching ? total : selected.size;
    return { scope, count: n, label: matching ? (filtered ? `All ${n} users matching the filter, on every page` : `All ${n} users`) : `${n} selected ${n === 1 ? "user" : "users"}` };
  }, [dialog, allMatching, filter, selected, total, filtered]);

  const sortLink = (c: { key: SortKey; label: string }) => {
    const on = params.sort === c.key;
    return (
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          go({ sort: c.key, dir: on ? (params.dir === "asc" ? "desc" : "asc") : c.key === "name" || c.key === "role" || c.key === "status" ? "asc" : "desc", page: 1 });
        }}
      >
        {c.label}
        {on ? (params.dir === "asc" ? " ↑" : " ↓") : ""}
      </a>
    );
  };

  const pageButtons = (() => {
    const set = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2].filter((n) => n >= 1 && n <= pages));
    const list = [...set].sort((a, b) => a - b);
    const out: (number | "gap")[] = [];
    list.forEach((n, i) => {
      if (i && n - list[i - 1] > 1) out.push("gap");
      out.push(n);
    });
    return out;
  })();
  const from = total ? (page - 1) * params.perPage + 1 : 0;
  const to = Math.min(total, page * params.perPage);

  // ---- filter form
  const [draft, setDraft] = useState<UserFilter>(filter);
  const set = (p: Partial<UserFilter>) => setDraft((d) => ({ ...d, ...p }));
  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean: UserFilter = {};
    for (const [k, v] of Object.entries(draft)) if (v !== undefined && v !== "" && v !== false && !(Array.isArray(v) && !v.length)) (clean as Record<string, unknown>)[k] = v;
    if (!clean.course) delete clean.courseStatus;
    go({ filter: clean });
  };
  const num = (v: string) => (v ? Number(v) : undefined);
  const chips: { label: string; clear: () => void }[] = [];
  const nameOf = (list: { id: number; label: string }[], id?: number) => list.find((o) => o.id === id)?.label ?? `#${id}`;
  const drop = (k: keyof UserFilter) => () => {
    const n = { ...filter };
    delete n[k];
    if (k === "course") delete n.courseStatus;
    setDraft(n);
    go({ filter: n });
  };
  if (filter.q) chips.push({ label: `Search: ${filter.q}`, clear: drop("q") });
  if (filter.role) chips.push({ label: `Role: ${ROLE_LABELS[filter.role as Role] ?? filter.role}`, clear: drop("role") });
  if (filter.status) chips.push({ label: filter.status === "active" ? "Active" : "Banned / disabled", clear: drop("status") });
  if (filter.signin) chips.push({ label: SIGNIN_CHOICES[filter.signin], clear: drop("signin") });
  if (filter.pw) chips.push({ label: PASSWORD_CHOICES[filter.pw], clear: drop("pw") });
  if (filter.country) chips.push({ label: `Country: ${filter.country}`, clear: drop("country") });
  if (filter.course) chips.push({ label: `In course: ${nameOf(options.courses, filter.course)}${filter.courseStatus ? ` (${COURSE_STATUS_CHOICES[filter.courseStatus].toLowerCase()})` : ""}`, clear: drop("course") });
  if (filter.notCourse) chips.push({ label: `Not in course: ${nameOf(options.courses, filter.notCourse)}`, clear: drop("notCourse") });
  if (filter.community) chips.push({ label: `In community: ${nameOf(options.communities, filter.community)}`, clear: drop("community") });
  if (filter.notCommunity) chips.push({ label: `Not in community: ${nameOf(options.communities, filter.notCommunity)}`, clear: drop("notCommunity") });
  if (filter.tag?.length) chips.push({ label: `Tag: ${filter.tag.map((t) => nameOf(options.tags, t)).join(" or ")}`, clear: drop("tag") });
  if (filter.notTag) chips.push({ label: `Without tag: ${nameOf(options.tags, filter.notTag)}`, clear: drop("notTag") });
  if (filter.untagged) chips.push({ label: "No tags", clear: drop("untagged") });
  if (filter.from) chips.push({ label: `Created from ${filter.from}`, clear: drop("from") });
  if (filter.to) chips.push({ label: `Created until ${filter.to}`, clear: drop("to") });

  const removeTag = async (userId: string, tagId: number) => {
    try {
      await api("users/bulk", { method: "POST", body: { scope: { ids: [userId] }, action: "tag_remove", tagId } });
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Something went wrong", "error");
    }
  };

  return (
    <div>
      <form className="bbu-bar" onSubmit={apply}>
        <input type="search" placeholder="Search name, email, username, company, phone..." aria-label="Search" value={draft.q ?? ""} onChange={(e) => set({ q: e.target.value })} />
        <select aria-label="Role" value={draft.role ?? ""} onChange={(e) => set({ role: e.target.value || undefined })}>
          <option value="">Any role</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <select aria-label="Status" value={draft.status ?? ""} onChange={(e) => set({ status: (e.target.value || undefined) as UserFilter["status"] })}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="disabled">Banned / disabled</option>
        </select>
        <select aria-label="Tag" value={draft.tag?.[0] ?? ""} onChange={(e) => set({ tag: e.target.value ? [Number(e.target.value)] : undefined })}>
          <option value="">Any tag</option>
          {options.tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label} ({t.count})
            </option>
          ))}
        </select>
        <select aria-label="Course" value={draft.course ?? ""} onChange={(e) => set({ course: num(e.target.value) })}>
          <option value="">Any course</option>
          {options.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <button type="submit" className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm">
          Filter
        </button>
        {filtered ? (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setDraft({});
              go({ filter: {} });
            }}
          >
            Clear
          </a>
        ) : null}
      </form>

      <details className="bbu-more" open={!!(filter.signin || filter.pw || filter.country || filter.notCourse || filter.community || filter.notCommunity || filter.notTag || filter.untagged || filter.from || filter.to || filter.courseStatus)}>
        <summary>More filters</summary>
        <form className="bbu-more__grid" onSubmit={apply}>
          <label>
            Course status
            <select value={draft.courseStatus ?? ""} onChange={(e) => set({ courseStatus: (e.target.value || undefined) as UserFilter["courseStatus"] })} disabled={!draft.course}>
              <option value="">Any (needs a course above)</option>
              {Object.entries(COURSE_STATUS_CHOICES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Not in course
            <select value={draft.notCourse ?? ""} onChange={(e) => set({ notCourse: num(e.target.value) })}>
              <option value="">-</option>
              {options.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            In community
            <select value={draft.community ?? ""} onChange={(e) => set({ community: num(e.target.value) })}>
              <option value="">-</option>
              {options.communities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Not in community
            <select value={draft.notCommunity ?? ""} onChange={(e) => set({ notCommunity: num(e.target.value) })}>
              <option value="">-</option>
              {options.communities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Without tag
            <select value={draft.notTag ?? ""} onChange={(e) => set({ notTag: num(e.target.value) })}>
              <option value="">-</option>
              {options.tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tags
            <select value={draft.untagged ? "1" : ""} onChange={(e) => set({ untagged: e.target.value === "1" || undefined })}>
              <option value="">-</option>
              <option value="1">Has no tags at all</option>
            </select>
          </label>
          <label>
            Sign-in
            <select value={draft.signin ?? ""} onChange={(e) => set({ signin: (e.target.value || undefined) as UserFilter["signin"] })}>
              <option value="">Any</option>
              {Object.entries(SIGNIN_CHOICES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Password
            <select value={draft.pw ?? ""} onChange={(e) => set({ pw: (e.target.value || undefined) as UserFilter["pw"] })}>
              <option value="">Any</option>
              {Object.entries(PASSWORD_CHOICES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Country
            <input type="text" list="bbu-countries" value={draft.country ?? ""} onChange={(e) => set({ country: e.target.value })} />
            <datalist id="bbu-countries">
              {options.countries.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label>
            Created from
            <input type="date" value={draft.from ?? ""} onChange={(e) => set({ from: e.target.value || undefined })} />
          </label>
          <label>
            Created until
            <input type="date" value={draft.to ?? ""} onChange={(e) => set({ to: e.target.value || undefined })} />
          </label>
          <div style={{ alignSelf: "end" }}>
            <button type="submit" className="bbfa-btn bbfa-btn--sm">
              Apply filters
            </button>
          </div>
        </form>
      </details>

      <div className="bbu-bar" style={{ justifyContent: "space-between" }}>
        <div className="bbu-active">
          <strong>{total.toLocaleString("en-US")}</strong>&nbsp;{total === 1 ? "user" : "users"}
          {chips.map((c) => (
            <span key={c.label} className="bbu-tag">
              {c.label}
              <button type="button" aria-label={`Remove filter ${c.label}`} onClick={c.clear}>
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="bbu-actions">
          {filtered && total ? (
            <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => setDialog({ group: "tags", scope: "filter" })}>
              Save these {total} as a tag
            </button>
          ) : null}
          <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => setDialog({ group: "export", scope: count ? "selection" : "filter" })}>
            Export CSV{count ? ` (${count})` : filtered ? ` (${total})` : ""}
          </button>
          <Link className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" href="/admin/users/tags">
            Tags
          </Link>
          <button className="bbfa-btn bbfa-btn--sm" onClick={() => setAdding(true)}>
            Add user
          </button>
        </div>
      </div>

      {count ? (
        <div className="bbu-selbar" role="toolbar" aria-label="Actions for the selected users">
          <strong>{count.toLocaleString("en-US")} selected</strong>
          {(["tags", "courses", "communities", "account"] as Group[]).map((g) => (
            <button key={g} className="bbfa-btn bbfa-btn--ghost" onClick={() => setDialog({ group: g, scope: "selection" })}>
              {{ tags: "Tags", courses: "Courses", communities: "Communities", account: "Account" }[g as "tags"]}
            </button>
          ))}
          <button className="bbfa-btn bbfa-btn--ghost" onClick={() => setDialog({ group: "export", scope: "selection" })}>
            Export
          </button>
          <button className="bbu-link" onClick={clear}>
            Clear selection
          </button>
        </div>
      ) : null}

      {allOnPage && !allMatching && total > rows.length ? (
        <p className="bbu-banner">
          All {rows.length} users on this page are selected.{" "}
          <button type="button" onClick={() => setAllMatching(true)}>
            Select all {total.toLocaleString("en-US")} {filtered ? "matching " : ""}users on every page
          </button>
        </p>
      ) : null}
      {allMatching ? (
        <p className="bbu-banner">
          All {total.toLocaleString("en-US")} {filtered ? "matching " : ""}users on every page are selected.{" "}
          <button type="button" onClick={clear}>
            Clear selection
          </button>
        </p>
      ) : null}

      <div className="bbfa-table-wrap">
        <table className="bbfa-table bbu-table">
          <thead>
            <tr>
              <th className="bbu-check">
                <input type="checkbox" aria-label="Select all users on this page" checked={allOnPage || allMatching} onChange={toggleAll} />
              </th>
              {COLS.map((c) => (
                <th key={c.key} className={c.num ? "num" : ""}>
                  {sortLink(c)}
                </th>
              ))}
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((u) => (
                <tr key={u.id} className={selected.has(u.id) || allMatching ? "is-selected" : ""}>
                  <td className="bbu-check">
                    <input type="checkbox" aria-label={`Select ${u.name || u.email}`} checked={selected.has(u.id) || allMatching} onChange={() => toggle(u.id)} disabled={allMatching} />
                  </td>
                  <td>
                    <Link href={`/admin/users/${u.id}`}>
                      <strong>{u.name || u.email}</strong>
                    </Link>
                    <div className="bbfa-sub">
                      {u.name ? `${u.email}` : ""}
                      {u.id === me.id ? " · you" : ""}
                      {u.company ? ` · ${u.company}` : ""}
                    </div>
                  </td>
                  <td>{ROLE_LABELS[u.role as Role] ?? u.role}</td>
                  <td>
                    <span className={`bbfa-pill bbfa-pill--${u.status === "active" ? "active" : "closed"}`}>{u.status === "active" ? "Active" : "Banned"}</span>
                  </td>
                  <td className="num">{u.courses || "-"}</td>
                  <td className="num">{u.communities || "-"}</td>
                  <td>{u.lastLoginAt ? f.dateTime(u.lastLoginAt) : "never"}</td>
                  <td>{f.dateTime(u.createdAt)}</td>
                  <td>
                    <div className="bbu-tags">
                      {u.tags.map((t) => (
                        <span key={t.id} className="bbu-tag">
                          <Link href={`/admin/users?tag=${t.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                            {t.name}
                          </Link>
                          <button type="button" aria-label={`Remove tag ${t.name}`} onClick={() => removeTag(u.id, t.id)}>
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={COLS.length + 2} className="bbfa-muted" style={{ padding: 24 }}>
                  No users match. Clear the filters to see everyone.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bbu-pager">
        <span>{total ? `Showing ${from.toLocaleString("en-US")} to ${to.toLocaleString("en-US")} of ${total.toLocaleString("en-US")}` : "No results"}</span>
        {pages > 1 ? (
          <nav aria-label="Pages">
            <button disabled={page <= 1} onClick={() => go({ page: page - 1 })}>
              Previous
            </button>
            {pageButtons.map((n, i) =>
              n === "gap" ? (
                <span key={`g${i}`} style={{ alignSelf: "center" }}>
                  ...
                </span>
              ) : (
                <button key={n} className={n === page ? "is-on" : ""} aria-current={n === page ? "page" : undefined} onClick={() => go({ page: n })}>
                  {n}
                </button>
              ),
            )}
            <button disabled={page >= pages} onClick={() => go({ page: page + 1 })}>
              Next
            </button>
          </nav>
        ) : (
          <span />
        )}
        <label>
          Per page{" "}
          <select value={params.perPage} onChange={(e) => go({ per: Number(e.target.value) })}>
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {dialog && target ? (
        <BulkDialog
          group={dialog.group}
          target={target}
          options={options}
          roles={roles}
          defaultMode={dialog.mode}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            clear();
            router.refresh();
          }}
        />
      ) : null}
      {adding ? <AddUser roles={roles} onClose={() => setAdding(false)} onDone={() => (setAdding(false), router.refresh())} /> : null}

      <div className="bbfa-card">
        <div className="bbfa-card__head">
          <div className="bbfa-eyebrow">Roles</div>
          <h3>What each role can do</h3>
        </div>
        <table className="bbfa-table bbfa-sys">
          <tbody>
            {ROLES.map((r) => (
              <tr key={r}>
                <td>
                  <strong>{ROLE_LABELS[r]}</strong>
                </td>
                <td>{ROLE_HELP[r]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddUser({ roles, onClose, onDone }: { roles: Role[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ email: "", name: "", role: roles[roles.length - 1] ?? "viewer", password: "" });
  const [busy, setBusy] = useState(false);
  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("users", { method: "POST", body: form });
            toast("User created");
            onDone();
          } catch (err) {
            toast(err instanceof ApiError ? err.message : "Something went wrong", "error");
            setBusy(false);
          }
        }}
      >
        <Card eyebrow="New user" title="Add a person" desc="They sign in at /admin/login or /account/login with this email. Leave the password empty if they will use Google.">
          <TextField label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <TextField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <SelectField label="Role" value={form.role} onChange={(v) => setForm({ ...form, role: v as Role })} choices={Object.fromEntries(roles.map((r) => [r, ROLE_LABELS[r]]))} help={ROLE_HELP[form.role as Role]} />
          <TextField label="Password (min. 10 characters)" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
          <div className="bbfa-field bbfa-field--wide">
            <button type="submit" className={`bbfa-btn${busy ? " is-loading" : ""}`} disabled={!form.email || busy}>
              Create user
            </button>
          </div>
        </Card>
      </form>
    </Modal>
  );
}
