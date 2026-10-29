import Link from "next/link";
import { t } from "@/modules/community/strings";

export default function CommunityNotFound() {
  return (
    <div className="cm-page cm-page--narrow">
      <div className="cm-empty">
        <h2>{t.state.notFound}</h2>
        <p>This page does not exist, or you do not have access to it.</p>
        <Link href="/community" className="bb-btn bb-btn-outline">
          {t.nav.feed}
        </Link>
      </div>
    </div>
  );
}
