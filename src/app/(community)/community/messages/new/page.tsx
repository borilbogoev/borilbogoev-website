import { notFound, redirect } from "next/navigation";
import { CommunityError } from "@/modules/community/server/core";
import { openConversation } from "@/modules/community/server/chat";
import { requireViewer } from "@/modules/community/server/page";

// /community/messages/new?user=<id> opens (or creates) the conversation and redirects into it.
export default async function NewMessage({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  const viewer = await requireViewer();
  const { user = "" } = await searchParams;
  let id: number;
  try {
    id = await openConversation(viewer, user);
  } catch (e) {
    if (e instanceof CommunityError) {
      if (e.status === 404) notFound();
      redirect(`/community/messages?error=${encodeURIComponent(e.message)}`);
    }
    throw e;
  }
  redirect(`/community/messages/${id}`);
}
