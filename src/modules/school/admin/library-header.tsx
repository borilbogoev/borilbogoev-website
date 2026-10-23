import { can, type Role } from "@/modules/auth/roles";
import { LibraryTabs } from "./tabs";

/** The tabs of the School library, limited to what the viewer's role may open. */
export function SchoolTabs({ role }: { role: Role }) {
  const items = [
    { href: "/admin/school", label: "Courses", show: can(role, "school.view") },
    { href: "/admin/school/dashboard", label: "Dashboard", show: can(role, "school.view") },
    { href: "/admin/school/categories", label: "Categories", show: can(role, "school.view") },
    { href: "/admin/school/students", label: "Students", show: can(role, "school.view") },
    { href: "/admin/school/discussion", label: "Discussion", show: can(role, "school.moderate") },
    { href: "/admin/school/settings", label: "Settings", show: can(role, "school.settings") },
  ];
  return <LibraryTabs items={items.filter((i) => i.show)} />;
}
