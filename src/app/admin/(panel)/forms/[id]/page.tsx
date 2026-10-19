import { redirect } from "next/navigation";

export default async function FormIndex({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/admin/forms/${(await params).id}/builder`);
}
