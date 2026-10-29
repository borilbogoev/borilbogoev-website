import { notFound } from "next/navigation";
import { ConversationThread } from "@/modules/community/components/chat";
import { getParticipantConversation, listMessages } from "@/modules/community/server/chat";
import { CommunityError, toId } from "@/modules/community/server/core";
import { me, requireViewer } from "@/modules/community/server/page";
import { loadPeople } from "@/modules/community/server/people";
import { canDirectMessage } from "@/modules/community/server/permissions";
import { hasBlocked } from "@/modules/community/server/safety";

export const metadata = { title: "Conversation" };

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer();
  const id = toId((await params).id);
  if (!id) notFound();
  const data = await load(viewer, id);
  return (
    <div className="cm-page cm-page--narrow">
      <ConversationThread
        conversationId={id}
        other={data.other}
        me={data.me}
        initial={data.msgs.items}
        initialPeople={data.people}
        initialNext={data.msgs.nextCursor}
        canSend={data.canSend}
      />
    </div>
  );
}

async function load(viewer: Awaited<ReturnType<typeof requireViewer>>, id: number) {
  try {
    const conv = await getParticipantConversation(viewer, id);
    const [msgs, people, blocked] = await Promise.all([listMessages(viewer, id, {}), loadPeople([viewer.user.id, conv.otherId]), hasBlocked(conv.otherId, viewer.user.id)]);
    return {
      msgs,
      people: { ...msgs.people, ...people },
      other: people[conv.otherId] ?? { id: conv.otherId, name: "Member", username: "", avatarUrl: "" },
      me: people[viewer.user.id] ?? me(viewer),
      canSend: canDirectMessage(viewer.actor, { id: conv.otherId }, { blockedByTarget: blocked }).ok,
    };
  } catch (e) {
    if (e instanceof CommunityError) notFound();
    throw e;
  }
}
