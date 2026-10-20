import { redirect } from "next/navigation";

export default async function PresentationIndex({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/admin/presentations/${(await params).id}/builder`);
}
