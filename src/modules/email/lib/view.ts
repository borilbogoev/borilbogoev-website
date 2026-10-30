import { getEmailConfig, maskKey, type KeyState } from "./config";

export type EmailView = { keyState: KeyState; keyMask: string; fromEmail: string; fromName: string; replyTo: string; adminTo: string };

/** What the admin screen may know about the settings: where the key comes from and its last four characters. Never the whole key. */
export async function emailView(): Promise<EmailView> {
  const c = await getEmailConfig();
  return { keyState: c.keyState, keyMask: maskKey(c.apiKey), fromEmail: c.fromEmail, fromName: c.fromName, replyTo: c.replyTo, adminTo: c.adminTo };
}
