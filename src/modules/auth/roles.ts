// Roles and permissions. Add a permission here when a module needs a new kind of access.

export const ROLES = ["owner", "admin", "editor", "contributor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Superadmin / Owner",
  admin: "Admin",
  editor: "Editor",
  contributor: "Contributor",
  viewer: "Viewer",
};

export const ROLE_HELP: Record<Role, string> = {
  owner: "Everything, including other admins and the owner account.",
  admin: "Everything in Forms and Landing Pages, and manages editors, contributors and viewers.",
  editor: "Builds and edits forms and landing pages, manages responses.",
  contributor: "Reads responses, adds and edits records, exports CSV.",
  viewer: "Read-only access to forms, landing pages, responses and dashboards.",
};

export const PERMISSIONS = [
  "forms.view", // forms list, builder (read-only), dashboards, responses
  "responses.write", // add and edit records, mark read
  "responses.export", // CSV export
  "responses.delete",
  "forms.write", // create, edit, duplicate forms and change their status
  "forms.delete",
  "forms.settings", // global Forms settings
  "users.manage", // create users and change roles (an admin cannot touch admins or the owner)
  "landing.view", // landing pages list, builder (read-only), dashboards
  "landing.write", // create, edit, duplicate, publish and unpublish landing pages
  "landing.delete",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const viewer: Permission[] = ["forms.view", "landing.view"];
const contributor: Permission[] = [...viewer, "responses.write", "responses.export"];
const editor: Permission[] = [...contributor, "forms.write", "responses.delete", "landing.write"];
const admin: Permission[] = [...editor, "forms.delete", "forms.settings", "landing.delete", "users.manage"];

const GRANTS: Record<Role, readonly Permission[]> = {
  viewer,
  contributor,
  editor,
  admin,
  owner: PERMISSIONS,
};

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

export function can(role: string | null | undefined, permission: Permission): boolean {
  return isRole(role) && GRANTS[role].includes(permission);
}

/** Which roles `actor` may assign to others (owners only create admins and owners). */
export function assignableRoles(actor: Role): Role[] {
  if (actor === "owner") return [...ROLES];
  if (actor === "admin") return ["editor", "contributor", "viewer"];
  return [];
}

/** Whether `actor` may change or remove `target`. */
export function canManageUser(actor: Role, target: Role): boolean {
  if (actor === "owner") return true;
  return actor === "admin" && assignableRoles("admin").includes(target);
}
