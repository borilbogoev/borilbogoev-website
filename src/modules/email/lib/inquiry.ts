// The email the owner gets when someone fills in the inquiry form. A pure builder, shared with the test-email screen.
import { emailShell, escapeHtml } from "./layout";

export type Inquiry = { topic: string; plan?: string; name: string; email: string; company?: string; message: string; page?: string };

export function inquiryMail(d: Inquiry): { subject: string; html: string } {
  const row = (k: string, v: string) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#6b6b6b;font-size:13px;width:28%;vertical-align:top">${escapeHtml(k)}</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">${escapeHtml(v)}</td></tr>`;
  return {
    subject: `New inquiry: ${d.topic}${d.plan ? ` / ${d.plan}` : ""} from ${d.name}`,
    html: emailShell({
      eyebrow: "Inquiry",
      bodyHtml:
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px">${row("Topic", d.topic)}${row("Plan", d.plan || "not chosen")}${row("Name", d.name)}${row("Email", d.email)}${row("Company", d.company || "-")}${row("Page", d.page || "-")}</table>` +
        `<p style="margin:0">${escapeHtml(d.message).replace(/\n/g, "<br>")}</p>`,
    }),
  };
}
