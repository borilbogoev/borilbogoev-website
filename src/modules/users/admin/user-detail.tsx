"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, useConfirm, useFormatters, useToast } from "@/modules/forms/admin/ui";
import { ROLE_HELP, ROLE_LABELS, type Role } from "@/modules/auth/roles";
import type { FilterOptions, UserDetail } from "../server/query";
import "./users.css";

type Props = { detail: UserDetail; options: FilterOptions; me: { id: string; role: Role }; roles: Role[]; canManage: boolean; self: boolean };

export function UserDetailView({ detail, options, roles, canManage, self }: Props) {
  const { user: u, enrolments, memberships, tags } = detail;
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const f = useFormatters();
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState({ email: u.email, name: u.name, username: u.username, phone: u.phone, company: u.company, jobTitle: u.jobTitle, country: u.country, timezone: u.timezone, bio: u.bio });
  const [role, setRole] = useState(u.role);
  const [password, setPassword] = useState("");
  const [courseId, setCourseId] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [tagId, setTagId] = useState("");
  const [newTag, setNewTag] = useState("");

  const run = async (fn: () => Promise<unknown>, ok: string, then?: () => void) => {
    setBusy(true);
    try {
      const res = (await fn()) as { message?: string } | undefined;
      toast(res?.message ?? ok);
      if (then) then();
      else router.refresh();
      return true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Something went wrong", "error");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const patch = (body: Record<string, unknown>, ok: string, then?: () => void) => run(() => api(`users/${u.id}`, { method: "PATCH", body }), ok, then);
  const bulk = (body: Record<string, unknown>, ok: string) => run(() => api("users/bulk", { method: "POST", body: { scope: { ids: [u.id] }, ...body } }), ok);
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }));
  const inUse = (list: { id: number }[], id: number) => list.some((x) => x.id === id);

  const field = (k: keyof typeof v, label: string, type = "text") => (
    <label>
      {label}
      <input type={type} value={v[k]} onChange={(e) => set(k, e.target.value)} disabled={!canManage} />
    </label>
  );

  return (
    <div>
      <p>
        <Link href="/admin/users">← All users</Link>
      </p>

      <section className="bbfa-section">
        <div className="bbfa-section__head">
          <div>
            <div className="bbfa-eyebrow">Account</div>
            <h2>
              {u.email} <span className={`bbfa-pill bbfa-pill--${u.status === "active" ? "active" : "closed"}`}>{u.status === "active" ? "Active" : "Banned"}</span>
            </h2>
          </div>
        </div>
        <dl className="bbu-facts">
          <div>
            <dt>Role</dt>
            <dd>{ROLE_LABELS[u.role as Role] ?? u.role}</dd>
          </div>
          <div>
            <dt>Sign-in</dt>
            <dd>{u.hasPassword ? "Password or Google" : "Google only"}</dd>
          </div>
          <div>
            <dt>Last sign-in</dt>
            <dd>{u.lastLoginAt ? f.dateTime(u.lastLoginAt) : "never"}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{f.dateTime(u.createdAt)}</dd>
          </div>
          <div>
            <dt>Wrong passwords</dt>
            <dd>
              {u.failedAttempts}
              {u.lockedUntil && new Date(u.lockedUntil) > new Date() ? ` · locked until ${f.dateTime(u.lockedUntil)}` : ""}
            </dd>
          </div>
        </dl>
      </section>

      <section className="bbfa-section">
        <div className="bbfa-section__head">
          <div>
            <div className="bbfa-eyebrow">Profile</div>
            <h2>Details</h2>
          </div>
        </div>
        <form
          className="bbu-form"
          onSubmit={(e) => {
            e.preventDefault();
            void patch({ email: v.email, profile: { name: v.name, username: v.username, phone: v.phone, company: v.company, jobTitle: v.jobTitle, country: v.country, timezone: v.timezone, bio: v.bio } }, "Saved");
          }}
        >
          <div className="bbu-grid">
            {field("name", "Name")}
            {field("email", "Email", "email")}
            {field("username", "Username")}
            {field("phone", "Phone")}
            {field("company", "Company")}
            {field("jobTitle", "Job title")}
            {field("country", "Country")}
            {field("timezone", "Time zone")}
          </div>
          <label>
            Bio
            <textarea value={v.bio} maxLength={600} onChange={(e) => set("bio", e.target.value)} disabled={!canManage} />
          </label>
          {v.email.trim().toLowerCase() !== u.email ? <p className="bbfa-muted">Changing the email also changes which form responses show in the person&apos;s account, because responses are matched by email.</p> : null}
          {canManage ? (
            <div>
              <button type="submit" className={`bbfa-btn${busy ? " is-loading" : ""}`} disabled={busy}>
                Save changes
              </button>
            </div>
          ) : null}
        </form>
      </section>

      {canManage ? (
        <section className="bbfa-section">
          <div className="bbfa-section__head">
            <div>
              <div className="bbfa-eyebrow">Access</div>
              <h2>Role, password and status</h2>
            </div>
          </div>
          <div className="bbu-inline">
            <select value={role} onChange={(e) => setRole(e.target.value)} disabled={self || !roles.length} aria-label="Role">
              {[...new Set([u.role as Role, ...roles])].map((r) => (
                <option key={r} value={r} disabled={!roles.includes(r)}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" disabled={busy || self || role === u.role} onClick={() => patch({ role }, "Role changed")}>
              Change role
            </button>
            <span className="bbfa-muted">{ROLE_HELP[role as Role]}</span>
          </div>
          <div className="bbu-inline">
            <input type="password" placeholder="New password (min. 10 characters)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" style={{ minWidth: 280 }} />
            <button
              className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm"
              disabled={busy || password.length < 10}
              onClick={async () => {
                if (await patch({ password }, "Password changed. The user is signed out everywhere.")) setPassword("");
              }}
            >
              Set password
            </button>
          </div>
          <div className="bbu-inline">
            <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" disabled={busy} onClick={() => patch({ signout: true }, "Signed out everywhere")}>
              Sign out everywhere
            </button>
            {u.failedAttempts || u.lockedUntil ? (
              <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" disabled={busy} onClick={() => patch({ unlock: true }, "Sign-in unlocked")}>
                Unlock sign-in
              </button>
            ) : null}
            {!self ? (
              <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" disabled={busy} onClick={() => patch({ status: u.status === "active" ? "disabled" : "active" }, u.status === "active" ? "Account banned" : "Account enabled")}>
                {u.status === "active" ? "Ban the account" : "Enable the account"}
              </button>
            ) : null}
            {!self ? (
              <button
                className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm is-danger"
                disabled={busy}
                onClick={async () => {
                  if (await confirm(`Delete ${u.email} for good? Their enrolments, memberships and posts are deleted with them.`, "Delete")) {
                    await run(() => api(`users/${u.id}`, { method: "DELETE" }), "User deleted", () => router.push("/admin/users"));
                  }
                }}
              >
                Delete the user
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="bbfa-section">
        <div className="bbfa-section__head">
          <div>
            <div className="bbfa-eyebrow">Segments</div>
            <h2>Tags</h2>
          </div>
        </div>
        <div className="bbu-tags">
          {tags.length ? (
            tags.map((t) => (
              <span key={t.id} className="bbu-tag">
                <Link href={`/admin/users?tag=${t.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                  {t.name}
                </Link>
                <button type="button" aria-label={`Remove tag ${t.name}`} onClick={() => bulk({ action: "tag_remove", tagId: t.id }, "Tag removed")}>
                  ×
                </button>
              </span>
            ))
          ) : (
            <span className="bbfa-muted">No tags yet.</span>
          )}
        </div>
        <div className="bbu-inline">
          <select value={tagId} onChange={(e) => setTagId(e.target.value)} aria-label="Existing tag">
            <option value="">Add an existing tag...</option>
            {options.tags.filter((t) => !inUse(tags, t.id)).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" disabled={busy || !tagId} onClick={async () => (await bulk({ action: "tag_add", tagId: Number(tagId) }, "Tag added")) && setTagId("")}>
            Add
          </button>
          <input placeholder="or a new tag" value={newTag} maxLength={60} onChange={(e) => setNewTag(e.target.value)} aria-label="New tag" />
          <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" disabled={busy || !newTag.trim()} onClick={async () => (await bulk({ action: "tag_add", newTag }, "Tag added")) && setNewTag("")}>
            Create and add
          </button>
        </div>
      </section>

      <section className="bbfa-section">
        <div className="bbfa-section__head">
          <div>
            <div className="bbfa-eyebrow">School</div>
            <h2>Courses</h2>
          </div>
        </div>
        <div className="bbfa-table-wrap">
          <table className="bbfa-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Access</th>
                <th className="num">Progress</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {enrolments.length ? (
                enrolments.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/admin/school/${e.courseId}/builder`}>{e.title}</Link>
                      <div className="bbfa-sub">
                        {e.source === "admin" ? "Added by an admin" : "Enrolled themselves"} · {f.ago(e.createdAt)}
                      </div>
                    </td>
                    <td>
                      <span className={`bbfa-pill bbfa-pill--${e.status === "active" ? "active" : e.status === "pending" ? "draft" : "closed"}`}>{e.status === "revoked" ? "Removed" : e.status}</span>
                    </td>
                    <td className="num">
                      {e.completed}/{e.lessons}
                    </td>
                    <td className="bbfa-row-actions">
                      {e.status === "active" ? (
                        <a href="#" className="is-danger" onClick={(ev) => (ev.preventDefault(), void bulk({ action: "course_remove", courseId: e.courseId }, "Course access removed"))}>
                          Remove access
                        </a>
                      ) : (
                        <a href="#" onClick={(ev) => (ev.preventDefault(), void bulk({ action: "course_add", courseId: e.courseId }, "Course access opened"))}>
                          Open access
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="bbfa-muted" style={{ padding: 20 }}>
                    Not enrolled in any course.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="bbu-inline">
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="Course">
            <option value="">Enrol in a course...</option>
            {options.courses.filter((c) => !enrolments.some((e) => e.courseId === c.id && e.status === "active")).map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" disabled={busy || !courseId} onClick={async () => (await bulk({ action: "course_add", courseId: Number(courseId) }, "Enrolled")) && setCourseId("")}>
            Enrol
          </button>
        </div>
      </section>

      <section className="bbfa-section">
        <div className="bbfa-section__head">
          <div>
            <div className="bbfa-eyebrow">Community</div>
            <h2>Communities</h2>
          </div>
        </div>
        <div className="bbfa-table-wrap">
          <table className="bbfa-table">
            <thead>
              <tr>
                <th>Community</th>
                <th>Membership</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {memberships.length ? (
                memberships.map((m) => (
                  <tr key={m.communityId}>
                    <td>{m.name}</td>
                    <td>
                      <span className={`bbfa-pill bbfa-pill--${m.status === "active" ? "active" : "closed"}`}>{m.status === "banned" ? "Banned" : m.role}</span>
                    </td>
                    <td>{f.dateTime(m.joinedAt)}</td>
                    <td className="bbfa-row-actions">
                      {m.status === "banned" ? (
                        <a href="#" onClick={(ev) => (ev.preventDefault(), void bulk({ action: "community_unban", communityId: m.communityId }, "Ban lifted"))}>
                          Lift ban
                        </a>
                      ) : canManage && !self ? (
                        <a href="#" onClick={(ev) => (ev.preventDefault(), void bulk({ action: "community_ban", communityId: m.communityId }, "Banned from the community"))}>
                          Ban
                        </a>
                      ) : null}
                      <a href="#" className="is-danger" onClick={(ev) => (ev.preventDefault(), void bulk({ action: "community_remove", communityId: m.communityId }, "Removed from the community"))}>
                        Remove
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="bbfa-muted" style={{ padding: 20 }}>
                    Not a member of any community.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="bbu-inline">
          <select value={communityId} onChange={(e) => setCommunityId(e.target.value)} aria-label="Community">
            <option value="">Add to a community...</option>
            {options.communities.filter((c) => !memberships.some((m) => m.communityId === c.id)).map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" disabled={busy || !communityId} onClick={async () => (await bulk({ action: "community_add", communityId: Number(communityId) }, "Added to the community")) && setCommunityId("")}>
            Add
          </button>
        </div>
      </section>
    </div>
  );
}
