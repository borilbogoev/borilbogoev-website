"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLES, ROLE_HELP, ROLE_LABELS, assignableRoles, canManageUser, type Role } from "@/modules/auth/roles";
import { api, ApiError, Card, SelectField, TextField, useConfirm, useFormatters, useToast } from "./ui";

export type UserRow = { id: string; email: string; name: string; role: string; status: string; lastLoginAt: string | null; hasPassword: boolean };

export function UsersEditor({ users, me }: { users: UserRow[]; me: { id: string; role: Role } }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const f = useFormatters();
  const roles = assignableRoles(me.role);
  const [form, setForm] = useState({ email: "", name: "", role: roles[roles.length - 1] ?? "viewer", password: "" });
  const [busy, setBusy] = useState(false);

  const call = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Something went wrong", "error");
    } finally {
      setBusy(false);
    }
  };

  const manageable = (u: UserRow) => u.id !== me.id && canManageUser(me.role, u.role as Role);

  return (
    <div>
      <div className="bbfa-section">
        <div className="bbfa-section__head">
          <div>
            <div className="bbfa-eyebrow">Access</div>
            <h2>Users</h2>
          </div>
        </div>
        <div className="bbfa-table-wrap">
          <table className="bbfa-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Sign-in</th>
                <th>Last sign-in</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name || u.email}</strong>
                    {u.name ? <div className="bbfa-sub">{u.email}</div> : null}
                    {u.id === me.id ? <div className="bbfa-sub">you</div> : null}
                  </td>
                  <td>
                    {manageable(u) ? (
                      <select value={u.role} disabled={busy} onChange={(e) => call(() => api(`users/${u.id}`, { method: "PATCH", body: { role: e.target.value } }), "Role changed")}>
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      ROLE_LABELS[u.role as Role] ?? u.role
                    )}
                  </td>
                  <td>{u.hasPassword ? "Password / Google" : "Google"}</td>
                  <td>{u.lastLoginAt ? f.dateTime(u.lastLoginAt) : "never"}</td>
                  <td>
                    <span className={`bbfa-pill bbfa-pill--${u.status === "active" ? "active" : "closed"}`}>{u.status === "active" ? "Active" : "Disabled"}</span>
                  </td>
                  <td className="bbfa-row-actions">
                    {manageable(u) || u.id === me.id ? (
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          const pw = window.prompt(`New password for ${u.email} (at least 10 characters):`);
                          if (pw) void call(() => api(`users/${u.id}`, { method: "PATCH", body: { password: pw } }), "Password changed. The user is signed out everywhere.");
                        }}
                      >
                        Set password
                      </a>
                    ) : null}
                    {manageable(u) ? (
                      <>
                        <a href="#" onClick={(e) => (e.preventDefault(), void call(() => api(`users/${u.id}`, { method: "PATCH", body: { status: u.status === "active" ? "disabled" : "active" } }), u.status === "active" ? "User disabled" : "User enabled"))}>
                          {u.status === "active" ? "Disable" : "Enable"}
                        </a>
                        <a
                          href="#"
                          className="is-danger"
                          onClick={async (e) => {
                            e.preventDefault();
                            if (await confirm(`Delete ${u.email}? They lose access at once.`)) void call(() => api(`users/${u.id}`, { method: "DELETE" }), "User deleted");
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
      </div>

      {roles.length ? (
        <form
          className="bbfa-settings__body"
          onSubmit={(e) => {
            e.preventDefault();
            void call(async () => {
              await api("users", { method: "POST", body: form });
              setForm({ ...form, email: "", name: "", password: "" });
            }, "User created");
          }}
        >
          <Card eyebrow="New user" title="Add a person" desc="They sign in at /admin/login with this email. Leave the password empty if they will use Google.">
            <TextField label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <TextField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <SelectField label="Role" value={form.role} onChange={(v) => setForm({ ...form, role: v as Role })} choices={Object.fromEntries(roles.map((r) => [r, ROLE_LABELS[r]]))} help={ROLE_HELP[form.role as Role]} />
            <TextField label="Password (min. 10 characters)" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
            <div className="bbfa-field bbfa-field--wide">
              <button type="submit" className={`bbfa-btn${busy ? " is-loading" : ""}`} disabled={!form.email}>
                Create user
              </button>
            </div>
          </Card>
        </form>
      ) : null}

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
