// Every email the School sends, as pure builders (subject + HTML). The senders are in access.ts and signin.ts; the test-email
// screen in Admin > Settings > Email renders the same builders, so a test shows exactly what a person would get.
import { site } from "@/content/site";
import { emailShell, escapeHtml } from "@/modules/email/lib/layout";

const p = (html: string) => `<p style="margin:0 0 12px">${html}</p>`;

export type MailParts = { subject: string; html: string };

/** To the admin: a student asked to pay a course by bank transfer. */
export function paymentRequestMail(o: { studentName: string; studentEmail: string; courseTitle: string; price: string; reference: string }): MailParts {
  return {
    subject: `School: ${o.studentName || o.studentEmail} wants to join ${o.courseTitle}`,
    html: emailShell({
      eyebrow: "School",
      bodyHtml:
        p(`<strong>${escapeHtml(o.studentName || o.studentEmail)}</strong> (${escapeHtml(o.studentEmail)}) enrolled in <strong>${escapeHtml(o.courseTitle)}</strong> and will pay ${escapeHtml(o.price)} by bank transfer.`) +
        p(`Reference: <strong>${escapeHtml(o.reference)}</strong>`) +
        p("When the transfer arrives, confirm it in Students. The course opens for them at once."),
      cta: { label: "Open Students", url: `${site.url}/admin/school/students` },
    }),
  };
}

export type Bank = { beneficiary: string; bank: string; iban: string; swift: string; instructions: string };

/** To the student: how to pay, with the reference to write in the transfer. */
export function paymentInstructionsMail(o: { studentName: string; courseTitle: string; price: string; reference: string; bank: Bank }): MailParts {
  const rows = [
    ["Amount", o.price],
    ["Reference", o.reference],
    ["Beneficiary", o.bank.beneficiary],
    ["Bank", o.bank.bank],
    ["IBAN", o.bank.iban],
    ["SWIFT", o.bank.swift],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#6b6b6b;font-size:13px;width:34%">${escapeHtml(k)}</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">${escapeHtml(v)}</td></tr>`)
    .join("");
  const hasBank = Boolean(o.bank.iban || o.bank.beneficiary);
  return {
    subject: `Payment details for ${o.courseTitle}`,
    html: emailShell({
      eyebrow: "School",
      bodyHtml:
        p(`Hello${o.studentName ? ` ${escapeHtml(o.studentName)}` : ""},`) +
        p(`You enrolled in <strong>${escapeHtml(o.courseTitle)}</strong>. The course opens when your bank transfer is confirmed.`) +
        (hasBank
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 16px">${rows}</table>`
          : p(`Reference: <strong>${escapeHtml(o.reference)}</strong>. Bank details have not been added yet: reply to this email and they will be sent to you.`)) +
        (o.bank.instructions ? p(escapeHtml(o.bank.instructions).replace(/\n/g, "<br>")) : ""),
    }),
  };
}

/** To the student: the course is open. */
export function accessGrantedMail(o: { studentName: string; courseTitle: string; courseSlug: string; newAccount: boolean }): MailParts {
  return {
    subject: `You have access to ${o.courseTitle}`,
    html: emailShell({
      eyebrow: "School",
      bodyHtml:
        p(`Hello${o.studentName ? ` ${escapeHtml(o.studentName)}` : ""},`) +
        p(`You now have access to <strong>${escapeHtml(o.courseTitle)}</strong>.`) +
        p(o.newAccount ? "An account was created for this email address. Open the sign-in page, enter the address and we send you a link. There is no password to set." : "Sign in with your email address to start."),
      cta: { label: o.newAccount ? "Sign in" : "Open the course", url: o.newAccount ? `${site.url}/school/sign-in` : `${site.url}/school/${o.courseSlug}` },
    }),
  };
}
