import { notFound } from "next/navigation";
import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { can } from "@/modules/auth/roles";
import { latestForms } from "@/modules/forms/lib/forms";
import { DeckSettingsEditor } from "@/modules/presentations/admin/deck-settings";
import { formsUsedBy, getDeck, listCategories, listTags, tagsOf } from "@/modules/presentations/lib/presentations";

export const metadata = { title: "Presentation settings" };

export default async function PresentationSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("presentations.view");
  const deck = await getDeck(Number((await params).id));
  if (!deck) notFound();
  const [used, all, categories, tags, allTags] = await Promise.all([formsUsedBy(deck.id), latestForms(300), listCategories(), tagsOf(deck.id), listTags()]);
  return (
    <DeckSettingsEditor
      deckId={deck.id}
      title={deck.title}
      status={deck.status}
      slug={deck.slug}
      mode={deck.mode}
      orientation={deck.orientation}
      categoryId={deck.categoryId}
      tags={tags}
      hasPassword={!!deck.passwordHash}
      settings={deck.settings}
      siteUrl={site.url}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      allTags={allTags.map((t) => t.name)}
      usedForms={all.filter((f) => used.includes(f.id))}
      readOnly={!can(user.role, "presentations.write")}
    />
  );
}
