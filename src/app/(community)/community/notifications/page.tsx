import { NotificationList } from "@/modules/community/components/notification-list";
import { requireViewer } from "@/modules/community/server/page";
import { listNotifications } from "@/modules/community/server/notifications";
import { t } from "@/modules/community/strings";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const viewer = await requireViewer();
  const { items, people, nextCursor } = await listNotifications(viewer.user.id);
  return (
    <div className="cm-page cm-page--narrow">
      <header className="cm-head">
        <p className="eyebrow">{t.eyebrow.notifications}</p>
        <h1>
          {t.nav.notifications}
          <span className="accent">.</span>
        </h1>
      </header>
      <NotificationList initial={items} initialPeople={people} initialNext={nextCursor} />
    </div>
  );
}
