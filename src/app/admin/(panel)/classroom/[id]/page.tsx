import { redirect } from "next/navigation";

export default async function CourseIndex({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/admin/classroom/${(await params).id}/builder`);
}
