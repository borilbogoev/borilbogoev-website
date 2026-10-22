// The Classroom player (/classroom/<course>/<module>/...): the lesson fills the window, with its own slim top bar instead of the site header.
import "@/modules/classroom/components/classroom.css";

export default function ClassroomLayout({ children }: { children: React.ReactNode }) {
  return children;
}
