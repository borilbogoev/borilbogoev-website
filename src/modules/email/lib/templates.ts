// Every email the system can send, listed once. The test screen renders these with sample data through the same builders the
// real senders use, so a test email is what a real recipient would get. Add a template here when you add a new kind of email.
import { site } from "@/content/site";
import { renderFormMail, type FormMailContext } from "@/modules/forms/lib/notify";
import type { Form } from "@/modules/forms/lib/forms";
import type { Field } from "@/modules/forms/lib/blocks";
import { formSettingsDefaults, globalDefaults } from "@/modules/forms/lib/settings";
import { getGlobalSettings } from "@/modules/forms/lib/settings-store";
import { accessGrantedMail, paymentInstructionsMail, paymentRequestMail } from "@/modules/school/lib/mails";
import { signInLinkMail } from "@/modules/school/lib/signin";
import { inquiryMail } from "./inquiry";
import { emailShell } from "./layout";

export type TemplateInfo = { id: string; group: string; label: string; description: string };
type Template = TemplateInfo & { build: () => Promise<{ subject: string; html: string }> | { subject: string; html: string } };

const sampleForm = (): Form => ({
  id: 0,
  title: "Sample form",
  status: "active",
  slug: null,
  settings: formSettingsDefaults(),
  lastSeq: 1,
  authorId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

async function formCtx(): Promise<{ form: Form; g: Awaited<ReturnType<typeof getGlobalSettings>>; ctx: FormMailContext }> {
  const g = await getGlobalSettings().catch(() => globalDefaults());
  const field = (key: string, label: string, type: string) => ({ key, label, type, subtype: "", sub: "", required: 1, blockId: 0, block: {} }) as unknown as Field;
  const form = sampleForm();
  const ctx: FormMailContext = {
    form,
    response: { id: 0, form_id: 0, seq: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), duration: 40, device: "desktop", channel: "web", origin: "", is_read: false, values: {} },
    values: { first_name: "Alex", email: "alex@example.com", message: "This is a sample answer." },
    fields: [field("first_name", "First name", "text"), field("email", "Email", "email"), field("message", "Message", "textarea")],
    timeZone: g.timezone,
  };
  return { form, g, ctx };
}

const SAMPLE_BANK = { beneficiary: "Sample Company LLC", bank: "Sample Bank", iban: "AE00 0000 0000 0000 0000 000", swift: "SAMPAEXX", instructions: "Use your payment reference in the transfer description." };

export const TEMPLATES: Template[] = [
  {
    id: "test",
    group: "General",
    label: "Plain test message",
    description: "A short message that only proves the connection works.",
    build: () => ({ subject: `Test email from ${site.name}`, html: emailShell({ eyebrow: "Test", bodyHtml: `<p style="margin:0">If you can read this, Resend is connected and this sender address works.</p>` }) }),
  },
  {
    id: "school-sign-in-link",
    group: "School and account",
    label: "Sign-in link (student)",
    description: "Sent when a student asks for a link on the sign-in page. The link in a test email does not sign anyone in.",
    build: () => signInLinkMail({ name: "Alex", link: `${site.url}/school/sign-in` }),
  },
  {
    id: "school-payment-instructions",
    group: "School and account",
    label: "Payment details (to the student)",
    description: "Sent when a student enrols in a paid course: bank details and the payment reference.",
    build: () => paymentInstructionsMail({ studentName: "Alex", courseTitle: "Sample course", price: "AED 800", reference: "CR-00012", bank: SAMPLE_BANK }),
  },
  {
    id: "school-payment-request",
    group: "School and account",
    label: "Payment request (to you)",
    description: "Sent to the School notification address when a student chooses to pay by bank transfer.",
    build: () => paymentRequestMail({ studentName: "Alex Sample", studentEmail: "alex@example.com", courseTitle: "Sample course", price: "AED 800", reference: "CR-00012" }),
  },
  {
    id: "school-access-granted",
    group: "School and account",
    label: "Course access granted (to the student)",
    description: "Sent when you confirm a payment or add a student to a course.",
    build: () => accessGrantedMail({ studentName: "Alex", courseTitle: "Sample course", courseSlug: "sample-course", newAccount: false }),
  },
  {
    id: "forms-notification",
    group: "Forms",
    label: "New response (to you)",
    description: "The default notification for a form response. Each form can change its own wording.",
    build: async () => {
      const { form, g, ctx } = await formCtx();
      return renderFormMail("notification", form, g, ctx, `${site.url}/admin/forms`);
    },
  },
  {
    id: "forms-autoresponder",
    group: "Forms",
    label: "Confirmation (to the respondent)",
    description: "The default confirmation a respondent can receive. Each form can switch it on and change its wording.",
    build: async () => {
      const { form, g, ctx } = await formCtx();
      return renderFormMail("autoresponder", form, g, ctx);
    },
  },
  {
    id: "inquiry",
    group: "Website",
    label: "Inquiry (to you)",
    description: "Sent to your admin address when someone uses the inquiry form.",
    build: () => inquiryMail({ topic: "Sessions", plan: "One session", name: "Alex Sample", email: "alex@example.com", company: "Sample Co", message: "This is a sample inquiry.\nIt has two lines.", page: "/sessions" }),
  },
];

export const templateInfos = (): TemplateInfo[] => TEMPLATES.map(({ id, group, label, description }) => ({ id, group, label, description }));

export async function buildTemplate(id: string) {
  const t = TEMPLATES.find((x) => x.id === id);
  return t ? { template: t.id, ...(await t.build()) } : null;
}
