// The email sender and settings against an in-memory Postgres (PGlite) with the real migrations. Resend itself is replaced by a
// fake `fetch`, so these tests prove what the code sends and how it reports the answer. They cannot prove a real delivery.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { before, beforeEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { setDbForTests, db, type Db } from "@/db/use";

process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-123456";
delete process.env.RESEND_API_KEY;

type Call = { url: string; headers: Record<string, string>; body: Record<string, unknown> };
let calls: Call[] = [];
let answer: { status: number; json: unknown } = { status: 200, json: { id: "email_123" } };
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string, init: RequestInit) => {
  if (!String(url).startsWith("https://api.resend.com/")) return realFetch(url, init);
  calls.push({ url: String(url), headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
  return new Response(JSON.stringify(answer.json), { status: answer.status, headers: { "Content-Type": "application/json" } });
}) as typeof fetch;

const KEY = "re_abcdefghijklmnopqrstuvwxyz123456";

before(async () => {
  const pg = new PGlite();
  for (const f of fs.readdirSync("drizzle").filter((x) => x.endsWith(".sql")).sort()) await pg.exec(fs.readFileSync(path.join("drizzle", f), "utf8").replaceAll("--> statement-breakpoint", ""));
  setDbForTests(drizzle(pg, { schema }) as unknown as Db);
});
beforeEach(async () => {
  calls = [];
  answer = { status: 200, json: { id: "email_123" } };
  await db().delete(schema.bbformsSettings);
});

test("the key is stored encrypted and never shown whole", async () => {
  const { saveEmailConfig, getEmailConfig, maskKey } = await import("../lib/config");
  await saveEmailConfig({ apiKey: KEY, fromEmail: "hello@example.com", fromName: "Boril", replyTo: "", adminTo: "me@example.com" });
  const [row] = await db().select().from(schema.bbformsSettings).where(eq(schema.bbformsSettings.name, "email_resend_key"));
  assert.ok(String(row.value).startsWith("enc1:"));
  assert.ok(!String(row.value).includes(KEY));
  const c = await getEmailConfig();
  assert.equal(c.apiKey, KEY);
  assert.equal(c.keyState, "database");
  assert.ok(!maskKey(c.apiKey).includes(KEY.slice(0, 20)));
  assert.ok(maskKey(c.apiKey).endsWith(KEY.slice(-4)));
});

test("a value that is not a Resend key, or a bad address, is refused", async () => {
  const { saveEmailConfig, EmailConfigError } = await import("../lib/config");
  const base = { fromEmail: "", fromName: "", replyTo: "", adminTo: "" };
  await assert.rejects(saveEmailConfig({ ...base, apiKey: "not-a-key" }), EmailConfigError);
  await assert.rejects(saveEmailConfig({ ...base, fromEmail: "nope" }), EmailConfigError);
  await assert.rejects(saveEmailConfig({ ...base, adminTo: "a@b.co, nope" }), EmailConfigError);
});

test("saving the sender without a key keeps the saved key; an empty key removes it", async () => {
  const { saveEmailConfig, getEmailConfig } = await import("../lib/config");
  const base = { fromEmail: "hello@example.com", fromName: "Boril", replyTo: "", adminTo: "" };
  await saveEmailConfig({ ...base, apiKey: KEY });
  await saveEmailConfig({ ...base, fromName: "Other" });
  assert.equal((await getEmailConfig()).apiKey, KEY);
  await saveEmailConfig({ ...base, apiKey: "" });
  assert.equal((await getEmailConfig()).keyState, "none");
});

test("sendEmail posts to Resend with the saved key and sender, and logs the result", async () => {
  const { saveEmailConfig, getEmailLog } = await import("../lib/config");
  const { sendEmail } = await import("../lib/send");
  await saveEmailConfig({ apiKey: KEY, fromEmail: "hello@example.com", fromName: "Boril", replyTo: "reply@example.com", adminTo: "" });
  const r = await sendEmail({ to: ["a@example.com"], subject: "Hi", html: "<p>Hello <a href=\"https://x.test\">link</a></p>", template: "test" });
  assert.deepEqual(r, { ok: true, id: "email_123" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers.Authorization, `Bearer ${KEY}`);
  assert.equal(calls[0].body.from, "Boril <hello@example.com>");
  assert.deepEqual(calls[0].body.to, ["a@example.com"]);
  assert.equal(calls[0].body.reply_to, "reply@example.com");
  assert.match(String(calls[0].body.text), /Hello link \(https:\/\/x\.test\)/);
  const log = await getEmailLog();
  assert.equal(log[0].ok, true);
  assert.equal(log[0].template, "test");
});

test("a refusal from Resend is reported as a failure with its message", async () => {
  const { saveEmailConfig, getEmailLog } = await import("../lib/config");
  const { sendEmail } = await import("../lib/send");
  await saveEmailConfig({ apiKey: KEY, fromEmail: "hello@example.com", fromName: "", replyTo: "", adminTo: "" });
  answer = { status: 403, json: { name: "validation_error", message: "The example.com domain is not verified." } };
  const r = await sendEmail({ to: ["a@example.com"], subject: "Hi", html: "<p>x</p>", template: "test" });
  assert.equal(r.ok, false);
  assert.match(r.ok ? "" : r.error, /403.*not verified/);
  assert.equal((await getEmailLog())[0].ok, false);
});

test("with no key nothing is sent and the caller is told why", async () => {
  const { sendEmail } = await import("../lib/send");
  const r = await sendEmail({ to: ["a@example.com"], subject: "Hi", html: "<p>x</p>", template: "test" });
  assert.equal(r.ok, false);
  assert.equal(calls.length, 0);
});

test("every template builds a subject and a body", async () => {
  const { TEMPLATES, buildTemplate } = await import("../lib/templates");
  assert.ok(TEMPLATES.length >= 8);
  for (const t of TEMPLATES) {
    const b = await buildTemplate(t.id);
    assert.ok(b && b.subject.length > 3 && b.html.includes("<html"), t.id);
  }
});

test("the sign-in link reports a failed send instead of claiming success", async () => {
  const { saveEmailConfig } = await import("../lib/config");
  const { sendSignInLink } = await import("@/modules/school/lib/signin");
  await db().insert(schema.users).values({ email: "student@example.com", name: "S", role: "student", username: "s1" });
  const input = { email: "student@example.com", origin: "https://example.com", ip: "1.1.1.1" };

  const off = await sendSignInLink({ ...input, ip: "1.1.1.2" });
  assert.equal(off.ok, false); // no key yet
  assert.equal(calls.length, 0);

  await saveEmailConfig({ apiKey: KEY, fromEmail: "hello@example.com", fromName: "", replyTo: "", adminTo: "" });
  answer = { status: 500, json: { message: "down" } };
  const failed = await sendSignInLink({ ...input, ip: "1.1.1.3" });
  assert.equal(failed.ok, false);

  answer = { status: 200, json: { id: "email_9" } };
  const ok = await sendSignInLink({ ...input, ip: "1.1.1.4" });
  assert.equal(ok.ok, true);
  const last = calls[calls.length - 1];
  assert.deepEqual(last.body.to, ["student@example.com"]);
  assert.match(String(last.body.html), /\/api\/school\/auth\/verify\?token=/);
});
