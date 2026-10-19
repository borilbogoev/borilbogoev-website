import type { Permission } from "./auth/roles";

/**
 * Admin modules. Each module is ONE entry in the admin navigation and on the admin home;
 * its own sub-pages (settings, tabs) live inside the module. Add a new module here.
 */
export type AdminModule = { key: string; label: string; href: string; desc: string; permission: Permission };

export const adminModules: AdminModule[] = [
  { key: "forms", label: "Forms", href: "/admin/forms", desc: "Build forms, read responses, see how they perform.", permission: "forms.view" },
];

/** Admin-wide screens that are not modules. */
export const adminCore: AdminModule[] = [{ key: "users", label: "Users", href: "/admin/users", desc: "Who can sign in, and what they can do.", permission: "users.manage" }];
