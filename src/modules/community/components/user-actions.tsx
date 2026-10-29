"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { del, message, post } from "../lib/client";
import { t } from "../strings";
import { Menu } from "./menu";
import { ReportDialog } from "./report-dialog";
import { toast } from "./toast";

/** Opens (or creates) the one direct conversation with this person. */
export function StartChatButton({ userId, className = "bb-btn bb-btn-outline", label = t.action.message }: { userId: string; className?: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { id } = await post<{ id: number }>("/api/community/conversations", { userId });
          router.push(`/community/messages/${id}`);
        } catch (e) {
          toast(message(e), "error");
          setBusy(false);
        }
      }}
    >
      {label}
    </button>
  );
}

export function BlockUserButton({ userId, blocked: initial = false }: { userId: string; blocked?: boolean }) {
  const [blocked, setBlocked] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="bb-btn bb-btn-outline"
      disabled={busy}
      onClick={async () => {
        if (!blocked && !window.confirm(t.safety.blockConfirm)) return;
        setBusy(true);
        try {
          if (blocked) await del(`/api/community/blocks/${userId}`);
          else await post("/api/community/blocks", { userId });
          setBlocked(!blocked);
          toast(blocked ? t.safety.unblocked : t.safety.blocked);
        } catch (e) {
          toast(message(e), "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      {blocked ? t.action.unblock : t.action.block}
    </button>
  );
}

/** "Block / Report" on someone else's profile. */
export function ProfileMenu({ userId, blocked: initial = false }: { userId: string; blocked?: boolean }) {
  const [report, setReport] = useState(false);
  const [blocked, setBlocked] = useState(initial);
  return (
    <>
      <Menu
        label="More"
        items={[
          blocked
            ? { label: t.action.unblock, onSelect: async () => { try { await del(`/api/community/blocks/${userId}`); setBlocked(false); toast(t.safety.unblocked); } catch (e) { toast(message(e), "error"); } } }
            : { label: t.action.block, onSelect: async () => { if (!window.confirm(t.safety.blockConfirm)) return; try { await post("/api/community/blocks", { userId }); setBlocked(true); toast(t.safety.blocked); } catch (e) { toast(message(e), "error"); } } },
          { label: t.action.report, onSelect: () => setReport(true), danger: true },
        ]}
      />
      <ReportDialog target={report ? { type: "user", id: userId } : null} onClose={() => setReport(false)} />
    </>
  );
}
