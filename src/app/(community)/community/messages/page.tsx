import { ConversationList } from "@/modules/community/components/chat";
import { listConversations } from "@/modules/community/server/chat";
import { requireViewer } from "@/modules/community/server/page";
import { t } from "@/modules/community/strings";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const viewer = await requireViewer();
  const { items, people } = await listConversations(viewer);
  return (
    <div className="cm-page cm-page--narrow">
      <header className="cm-head">
        <p className="eyebrow">{t.eyebrow.messages}</p>
        <h1>
          {t.chat.title}
          <span className="accent">.</span>
        </h1>
      </header>
      <ConversationList initial={items} initialPeople={people} />
    </div>
  );
}
