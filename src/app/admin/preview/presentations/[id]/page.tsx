import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/current";
import { DeckView } from "@/modules/presentations/components/deck";
import { DeckMount } from "@/modules/presentations/components/deck-client";
import { getDeck, getTree } from "@/modules/presentations/lib/presentations";

export const metadata: Metadata = { title: "Present", robots: { index: false, follow: false } };

// Presenter mode: the latest saved version of a deck, drafts included, full window, with speaker notes (N) and statistics off.
// It is the same view viewers get, so there is nothing to compare. Open it in its own tab and switch to your demo tabs freely.
export default async function PresentRoute({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("presentations.view");
  const deck = await getDeck(Number((await params).id));
  if (!deck) notFound();
  const slides = await getTree(deck.id);
  return (
    <>
      <DeckView deck={deck} slides={slides} presenter />
      <DeckMount />
    </>
  );
}
