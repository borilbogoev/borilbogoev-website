"use client";

import { t } from "@/modules/community/strings";

// Any unexpected failure inside Community lands here, with a way to try again.
export default function CommunityError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="cm-page cm-page--narrow">
      <div className="cm-empty" role="alert">
        <h2>{t.state.error}</h2>
        <p>Nothing was lost. Try again in a moment.</p>
        <button type="button" className="bb-btn bb-btn-primary" onClick={reset}>
          {t.action.retry}
        </button>
      </div>
    </div>
  );
}
