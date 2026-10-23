import { redirect } from "next/navigation";

export default async function CourseIndex({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/admin/school/${(await params).id}/builder`);
}
