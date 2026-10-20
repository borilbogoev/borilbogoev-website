import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/current";
import { DeckDashboardView } from "@/modules/presentations/admin/dashboard";
import { getDeck } from "@/modules/presentations/lib/presentations";

export const metadata = { title: "Presentation dashboard" };

export default async function PresentationDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("presentations.view");
  const deck = await getDeck(Number((await params).id));
  if (!deck) notFound();
  return <DeckDashboardView deckId={deck.id} />;
}
