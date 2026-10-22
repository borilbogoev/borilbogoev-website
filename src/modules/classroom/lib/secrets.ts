// Secrets typed into the admin (the Bunny.net token key) are stored encrypted, so a copy of the database alone does not reveal them.
// AES-256-GCM with a key derived from AUTH_SECRET. Changing AUTH_SECRET makes stored secrets unreadable: enter them again.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

function key(): Buffer {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET is missing or shorter than 32 characters.");
  return Buffer.from(hkdfSync("sha256", s, "classroom-secrets", "bb-classroom", 32));
}

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `enc1:${iv.toString("base64url")}:${c.getAuthTag().toString("base64url")}:${body.toString("base64url")}`;
}

/** The plain secret, or "" when it is empty or cannot be read with the current AUTH_SECRET. */
export function decryptSecret(stored: unknown): string {
  if (typeof stored !== "string" || !stored.startsWith("enc1:")) return "";
  const [, iv, tag, body] = stored.split(":");
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
  } catch {
    return "";
  }
}
