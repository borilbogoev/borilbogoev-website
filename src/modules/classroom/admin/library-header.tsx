import { can, type Role } from "@/modules/auth/roles";
import { LibraryTabs } from "./tabs";

/** The tabs of the Classroom library, limited to what the viewer's role may open. */
export function ClassroomTabs({ role }: { role: Role }) {
  const items = [
    { href: "/admin/classroom", label: "Courses", show: can(role, "classroom.view") },
    { href: "/admin/classroom/categories", label: "Categories", show: can(role, "classroom.view") },
    { href: "/admin/classroom/students", label: "Students", show: can(role, "classroom.view") },
    { href: "/admin/classroom/discussion", label: "Discussion", show: can(role, "classroom.moderate") },
    { href: "/admin/classroom/settings", label: "Settings", show: can(role, "classroom.settings") },
  ];
  return <LibraryTabs items={items.filter((i) => i.show)} />;
}
