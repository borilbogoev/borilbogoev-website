"use client";

import { useState } from "react";
import { message, post } from "../lib/client";
import { REPORT_REASONS, LIMITS, type ReportReason, type ReportTarget } from "../lib/constants";
import { t } from "../strings";
import { Dialog } from "./menu";
import { toast } from "./toast";

export function ReportDialog({ target, onClose }: { target: { type: ReportTarget; id: string | number } | null; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target || busy) return;
    setBusy(true);
    setError("");
    try {
      await post("/api/community/reports", { targetType: target.type, targetId: target.id, reason, details });
      toast(t.report.sent);
      setDetails("");
      onClose();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!target} title={t.report.title} onClose={onClose}>
      <form onSubmit={submit} className="cm-form">
        <p className="cm-muted">{t.report.intro}</p>
        <fieldset className="cm-fieldset">
          <legend>{t.report.reason}</legend>
          {REPORT_REASONS.map((r) => (
            <label key={r} className="cm-radio">
              <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
              {t.report.reasons[r]}
            </label>
          ))}
        </fieldset>
        <label className="cm-field">
          <span>{t.report.details}</span>
          <textarea className="cm-textarea" rows={3} maxLength={LIMITS.reportDetails} value={details} onChange={(e) => setDetails(e.target.value)} />
        </label>
        {error ? <p className="cm-error" role="alert">{error}</p> : null}
        <div className="cm-actions">
          <button type="button" className="bb-btn bb-btn-outline" onClick={onClose}>{t.action.cancel}</button>
          <button type="submit" className="bb-btn bb-btn-primary" disabled={busy}>{t.report.submit}</button>
        </div>
      </form>
    </Dialog>
  );
}
