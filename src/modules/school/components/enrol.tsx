"use client";

// Enrolment panel: sign in, enrol (free or by bank transfer), or continue. Used on the course page and where a lesson is locked.
import Link from "next/link";
import { useState } from "react";
import { api } from "./client-api";
import type { BankDetails, CourseStateData, ShellCourse } from "./types";
import "./school.css";

export function BankPanel({ bank, reference, price }: { bank: BankDetails | null; reference: string | null; price?: string }) {
  return (
    <div className="cr-bank">
      <p className="cr-eyebrow">Pay by bank transfer</p>
      {price ? (
        <p className="cr-bank__amount">
          Amount <strong>{price}</strong>
        </p>
      ) : null}
      {bank ? (
        <dl>
          {bank.beneficiary ? <><dt>Beneficiary</dt><dd>{bank.beneficiary}</dd></> : null}
          {bank.bank ? <><dt>Bank</dt><dd>{bank.bank}</dd></> : null}
          {bank.iban ? <><dt>IBAN</dt><dd className="cr-mono">{bank.iban}</dd></> : null}
          {bank.swift ? <><dt>SWIFT</dt><dd className="cr-mono">{bank.swift}</dd></> : null}
          {reference ? <><dt>Payment reference</dt><dd className="cr-mono"><strong>{reference}</strong></dd></> : null}
        </dl>
      ) : (
        <p>The bank details are not published yet. Contact us and we will send them.</p>
      )}
      {bank?.instructions ? <p className="cr-bank__note">{bank.instructions}</p> : null}
    </div>
  );
}

type Props = {
  course: ShellCourse;
  state: CourseStateData;
  /** Where to send a signed-out person after they sign in. */
  next: string;
  /** Where "Continue" and "Start" lead. */
  startHref: string;
  onChange: () => Promise<void> | void;
  compact?: boolean;
};

export function EnrolPanel({ course, state, next, startHref, onChange, compact }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [bank, setBank] = useState<{ bank: BankDetails | null; reference: string | null } | null>(null);

  const enrol = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ status: string; reference: string | null; bank: BankDetails | null }>(`courses/${course.id}/enrol`, { method: "POST", body: {} });
      if (res.status === "pending") setBank({ bank: res.bank, reference: res.reference });
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (!state.loaded) return <div className="cr-enrol cr-enrol--loading" aria-busy="true" />;

  const signIn = `/school/sign-in?next=${encodeURIComponent(next)}`;
  const paid = course.access === "paid";

  if (!state.signedIn) {
    return (
      <div className="cr-enrol">
        <Link className="bb-btn bb-btn-primary" href={signIn}>
          {paid ? `Sign in to enrol, ${course.priceLabel}` : course.access === "invite" ? "Sign in" : "Sign in to enrol, it is free"}
        </Link>
        {!compact ? <p className="cr-hint">New here? Enter your email on the next page. No password needed.</p> : null}
      </div>
    );
  }

  if (state.staff) {
    return (
      <div className="cr-enrol">
        <Link className="bb-btn bb-btn-primary" href={startHref}>
          Open the course
        </Link>
        <p className="cr-hint">You see every lesson as staff, including drafts.</p>
      </div>
    );
  }

  const e = state.enrolment;
  if (e?.status === "active") {
    return (
      <div className="cr-enrol">
        <Link className="bb-btn bb-btn-primary" href={startHref}>
          {state.completed.length ? "Continue learning" : "Start learning"}
        </Link>
      </div>
    );
  }
  if (e?.status === "pending" || bank) {
    return (
      <div className="cr-enrol">
        <p className="cr-enrol__status">Waiting for your payment</p>
        <BankPanel bank={bank?.bank ?? state.bank} reference={bank?.reference ?? e?.reference ?? null} price={course.priceLabel} />
        <p className="cr-hint">The course opens as soon as the transfer is confirmed, usually within one working day.</p>
      </div>
    );
  }
  if (e?.status === "revoked") {
    return (
      <div className="cr-enrol">
        <p className="cr-enrol__status">Your access to this course was removed.</p>
        <Link className="bb-btn bb-btn-outline" href="/contact">
          Contact us
        </Link>
      </div>
    );
  }
  if (course.access === "invite") {
    return (
      <div className="cr-enrol">
        <p className="cr-enrol__status">This course is by invitation.</p>
        <Link className="bb-btn bb-btn-outline" href="/contact">
          Ask for access
        </Link>
      </div>
    );
  }
  return (
    <div className="cr-enrol">
      <button type="button" className="bb-btn bb-btn-primary" onClick={enrol} disabled={busy}>
        {busy ? "One moment" : paid ? `Enrol, ${course.priceLabel}` : "Enrol for free"}
      </button>
      {paid && !compact ? <p className="cr-hint">You pay by bank transfer. We show the details after you enrol.</p> : null}
      {error ? (
        <p role="alert" className="cr-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
