import { redirect } from "next/navigation";

export default async function LandingIndex({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/admin/landing/${(await params).id}/builder`);
}
