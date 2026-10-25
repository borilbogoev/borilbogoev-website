// Roles and permissions. Add a permission here when a module needs a new kind of access.

export const ROLES = ["owner", "admin", "editor", "contributor", "viewer", "student"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Superadmin / Owner",
  admin: "Admin",
  editor: "Editor",
  contributor: "Contributor",
  viewer: "Viewer",
  student: "Student",
};

export const ROLE_HELP: Record<Role, string> = {
  owner: "Everything, including other admins and the owner account.",
  admin: "Everything in Forms, Landing Pages, Presentations and School, and manages editors, contributors, viewers and students.",
  editor: "Builds and edits forms, landing pages, presentations and courses, manages responses, answers student questions.",
  contributor: "Reads responses, adds and edits records, exports CSV.",
  viewer: "Read-only access to forms, landing pages, presentations, courses, responses and dashboards.",
  student: "Signs in to the School and learns in the courses they are enrolled in. No access to the admin.",
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
  "presentations.view", // presentations list, builder (read-only), dashboards, Present view
  "presentations.write", // create, edit, duplicate, activate and deactivate presentations, manage categories
  "presentations.delete",
  "school.view", // courses list, course builder (read-only), students, dashboards
  "school.write", // create, edit, duplicate, activate and deactivate categories, courses, modules and lessons
  "school.delete",
  "school.moderate", // read every comment and question, reply, hide, resolve
  "school.enrol", // enrol and remove students, confirm bank transfers
  "school.settings", // payment details, Bunny.net keys, sign-up rules
  "settings.manage", // site settings: the main menu
  "school.learn", // take the courses you are enrolled in (the only permission of a student)
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const viewer: Permission[] = ["forms.view", "landing.view", "presentations.view", "school.view"];
const contributor: Permission[] = [...viewer, "responses.write", "responses.export"];
const editor: Permission[] = [...contributor, "forms.write", "responses.delete", "landing.write", "presentations.write", "school.write", "school.moderate"];
const admin: Permission[] = [...editor, "forms.delete", "forms.settings", "landing.delete", "presentations.delete", "school.delete", "school.enrol", "school.settings", "settings.manage", "users.manage"];
const student: Permission[] = ["school.learn"];

const GRANTS: Record<Role, readonly Permission[]> = {
  viewer,
  contributor,
  editor,
  admin,
  student,
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
  if (actor === "admin") return ["editor", "contributor", "viewer", "student"];
  return [];
}

/** Whether `actor` may change or remove `target`. */
export function canManageUser(actor: Role, target: Role): boolean {
  if (actor === "owner") return true;
  return actor === "admin" && assignableRoles("admin").includes(target);
}

/** Whether a role may use the admin at all. Students only learn: they are sent to the School instead. */
export function canUseAdmin(role: string | null | undefined): boolean {
  return isRole(role) && GRANTS[role].some((p) => p !== "school.learn");
}
