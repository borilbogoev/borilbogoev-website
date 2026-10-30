# Email

Every email the site sends goes through one function, `sendEmail()` in `src/modules/email/lib/send.ts`, to Resend. It returns the truth (sent, or not and why) and writes a short log shown in Admin.

## Set up

Admin > Settings > Email.

1. Paste the Resend API key (starts with `re_`). It is stored encrypted (AES-256-GCM, key derived from `AUTH_SECRET`) in `bbforms_settings`. It is never shown again, only its last four characters. Changing `AUTH_SECRET` makes the saved key unreadable: enter it again.
2. Set the From address on a domain verified in Resend. Without one Resend only delivers to the owner of the Resend account.
3. Set your address for notices (inquiries, new form responses).
4. Use **Send a test email**: pick any email from the list and an address. The answer on screen is Resend's.

Fallback: if nothing is saved, `RESEND_API_KEY`, `INQUIRY_FROM_EMAIL` and `INQUIRY_TO_EMAIL` are still read.

## What is sent

| Email | When | To |
|---|---|---|
| Sign-in link | A student asks for a link on /school/sign-in or /account/login | the student |
| Payment details | A student enrols in a paid course | the student |
| Payment request | Same moment | School notification address, else your address for notices |
| Course access granted | You confirm a payment, or add a student under School > Students | the student |
| New response | A form response, if the form has notifications on | form recipients, else your address for notices |
| Confirmation | A form response, if the form has the autoresponder on | the respondent |
| Inquiry | The inquiry form | your address for notices |

Not sent: bulk enrolments (School > Students > bulk) and `scripts/enrol-respondents.ts` enrol people without emailing them. Community sends no email.

## Rules

- A failed send is a failure. The sign-in form shows an error, the Students screen says the student was not emailed, the log shows Resend's answer.
- The sign-in link gives the same answer for every address that is not a failure of the email system, so the form cannot be used to find out who has an account.
- Add a new kind of email: write a pure builder (subject and HTML, use `emailShell`), send it with `sendEmail({ template: "<id>", ... })`, and add it to `TEMPLATES` in `src/modules/email/lib/templates.ts` so it shows in the test list.
- Tests: `npm run test:email` (Resend is faked, so it proves what is sent, not delivery).
