import { notFound } from "next/navigation";
import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { latestForms } from "@/modules/forms/lib/forms";
import { PresentationBuilder } from "@/modules/presentations/admin/builder";
import { getDeck, getTree } from "@/modules/presentations/lib/presentations";

export const metadata = { title: "Build presentation" };

export default async function BuildPresentationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("presentations.view");
  const deck = await getDeck(Number((await params).id));
  if (!deck) notFound();
  const [slides, forms] = await Promise.all([getTree(deck.id), latestForms(300)]);
  return (
    <PresentationBuilder
      deckId={deck.id}
      slug={deck.slug}
      siteUrl={site.url}
      initialTitle={deck.title}
      initialStatus={deck.status}
      initialMode={deck.mode}
      initialOrientation={deck.orientation}
      dark={deck.settings.theme === "dark"}
      protectedDeck={!!deck.passwordHash}
      initialSlides={slides}
      forms={forms}
      canSave={can(user.role, "presentations.write")}
    />
  );
}
