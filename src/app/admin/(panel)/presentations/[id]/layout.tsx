import { notFound } from "next/navigation";
import { site } from "@/content/site";
import { requireUser } from "@/modules/auth/current";
import { CopyCode } from "@/modules/forms/admin/ui";
import { DeckTabs, StatusPill } from "@/modules/presentations/admin/tabs";
import { getDeck } from "@/modules/presentations/lib/presentations";
import { PageHeader } from "../../header";

// Header and tabs shared by every screen of one presentation.
export default async function PresentationLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser("presentations.view");
  const deck = await getDeck(Number(id));
  if (!deck) notFound();
  const url = `${site.url}/p/${deck.slug}`;
  const tabs = [
    { key: "builder", label: "Build" },
    { key: "settings", label: "Settings" },
    { key: "dashboard", label: "Dashboard" },
  ];
  return (
    <>
      <PageHeader
        eyebrow={`Presentation #${deck.id}`}
        title={
          <>
            {deck.title} <StatusPill status={deck.status} />
          </>
        }
        actions={
          <>
            <CopyCode text={url}>/p/{deck.slug}</CopyCode>
            {deck.status === "active" ? (
              <a className="bbfa-btn bbfa-btn--ghost" target="_blank" rel="noopener noreferrer" href={`/p/${deck.slug}`}>
                View live ↗
              </a>
            ) : null}
          </>
        }
      />
      <DeckTabs deckId={deck.id} tabs={tabs} />
      {children}
    </>
  );
}
