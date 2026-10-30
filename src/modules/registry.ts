import type { Permission } from "./auth/roles";

/**
 * Admin modules. Each module is ONE entry in the admin navigation and on the admin home;
 * its own sub-pages (settings, tabs) live inside the module. Add a new module here.
 */
export type AdminModule = { key: string; label: string; href: string; desc: string; permission: Permission };

export const adminModules: AdminModule[] = [
  { key: "forms", label: "Forms", href: "/admin/forms", desc: "Build forms, read responses, see how they perform.", permission: "forms.view" },
  { key: "landing", label: "Landing pages", href: "/admin/landing", desc: "Build pages at /l/<name> from blocks, publish them, see views and clicks.", permission: "landing.view" },
  { key: "presentations", label: "Presentations", href: "/admin/presentations", desc: "Build decks at /p/<name>: slides, accordion pages, demos and videos. Present them full window.", permission: "presentations.view" },
  { key: "school", label: "School", href: "/admin/school", desc: "Courses, modules and lessons at /school: video, audio, quizzes, notes, questions. Students, bank-transfer payments and access.", permission: "school.view" },
  { key: "community", label: "Communities", href: "/admin/communities", desc: "Communities at /community: members, moderators, reports, bans, suspensions and global settings.", permission: "community.manage" },
];

/** Admin-wide screens that are not modules. */
export const adminCore: AdminModule[] = [
  { key: "settings", label: "Settings", href: "/admin/settings", desc: "Site-wide settings. Menus: switch items on or off, add links, change the order. Email: the Resend key, sender and test emails.", permission: "settings.manage" },{ key: "users", label: "Users", href: "/admin/users", desc: "Who can sign in, and what they can do.", permission: "users.manage" }];
