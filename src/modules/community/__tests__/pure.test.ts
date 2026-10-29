import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeCursor, encodeCursor, isAfter } from "../lib/cursor";
import { neutralizeMentions, parseMentions, plainText, tokenize, toEditable, toStored } from "../lib/text";
import * as p from "../server/permissions";
import { coverOf, highlightsOf } from "../lib/rich";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

test("cursor round trip and ordering", () => {
  const row = { createdAt: new Date("2026-01-02T03:04:05.678Z"), id: 42 };
  const c = decodeCursor(encodeCursor(row));
  assert.deepEqual(c, { at: row.createdAt, id: 42 });
  assert.equal(decodeCursor("nope"), null);
  assert.equal(decodeCursor("2026-01-01T00:00:00.000Z_x"), null);
  assert.equal(decodeCursor(undefined), null);
  assert.ok(isAfter({ at: row.createdAt, id: 43 }, c!));
  assert.ok(!isAfter({ at: row.createdAt, id: 42 }, c!));
  assert.ok(isAfter({ at: new Date("2026-01-02T03:04:05.679Z"), id: 1 }, c!));
});

test("mentions parse, de-duplicate and cap", () => {
  const body = `Hi @[Ann](user:${U1}) and @[Ann again](user:${U1}) and @[Bob](user:${U2})`;
  assert.deepEqual(parseMentions(body).map((m) => m.userId), [U1, U2]);
  assert.equal(parseMentions(body, 1).length, 1);
  assert.equal(plainText(body), "Hi @Ann and @Ann again and @Bob");
});

test("invalid mentions become plain text", () => {
  const body = `@[Ann](user:${U1}) @[Bob](user:${U2})`;
  assert.equal(neutralizeMentions(body, new Set([U1])), `@[Ann](user:${U1}) @Bob`);
});

test("tokenize: links, mentions, no html", () => {
  const segs = tokenize(`see https://example.com/a?b=1, <b>x</b> @[Ann](user:${U1})`);
  assert.equal(segs[1].kind, "link");
  assert.deepEqual(segs[1], { kind: "link", href: "https://example.com/a?b=1", text: "https://example.com/a?b=1" });
  assert.equal(segs[2].kind, "text");
  assert.equal((segs[2] as { text: string }).text, ", <b>x</b> ");
  assert.equal(segs[3].kind, "mention");
  const js = tokenize("javascript:alert(1) http://x.y)");
  assert.ok(js.every((s) => s.kind !== "link" || s.href.startsWith("http")));
});

test("editor conversion round trip", () => {
  const stored = `Thanks @[Ann Lee](user:${U1}), cc @[Bob](user:${U2})!`;
  const { text, picks } = toEditable(stored);
  assert.equal(text, "Thanks @Ann Lee, cc @Bob!");
  assert.equal(toStored(text, picks), stored);
  // a deleted mention is dropped; a similar-looking name inside another word is not claimed
  assert.equal(toStored("hello @Ann Lee", [{ name: "Ann", userId: U1 }]), `hello @[Ann](user:${U1}) Lee`);
  assert.equal(toStored("hello @Annabel", [{ name: "Ann", userId: U1 }]), "hello @Annabel");
});

const actor = (o: Partial<p.Actor> = {}): p.Actor => ({ id: U1, superAdmin: false, suspended: false, ...o });
const comm = (o: Partial<p.CommunityState> = {}): p.CommunityState => ({ status: "active", visibility: "listed", joinMode: "open", ...o });
const member: p.MemberState = { role: "member", status: "active" };
const mod: p.MemberState = { role: "moderator", status: "active" };
const banned: p.MemberState = { role: "member", status: "banned" };
const live = { postingPaused: false };

test("permissions: view and join", () => {
  assert.equal(p.canView(null, null, comm()).ok, false);
  assert.equal(p.canView(actor(), null, comm()).ok, true);
  const hidden = comm({ visibility: "hidden" });
  assert.equal(p.canView(actor(), null, hidden).ok, false);
  assert.equal(p.canView(actor(), member, hidden).ok, true);
  assert.equal(p.canView(actor({ superAdmin: true }), null, hidden).ok, true);
  assert.equal(p.canJoin(actor(), null, comm()).ok, true);
  assert.equal(p.canJoin(actor(), member, comm()).ok, false);
  assert.equal(p.canJoin(actor(), null, comm({ joinMode: "closed" })).ok, false);
  assert.equal(p.canJoin(actor(), null, comm({ status: "archived" })).ok, false);
});

test("permissions: post and comment", () => {
  assert.equal(p.canPost(actor(), member, comm(), live).ok, true);
  assert.equal(p.canPost(actor(), null, comm(), live).ok, false, "visitor");
  assert.equal(p.canPost(actor(), banned, comm(), live).ok, false, "banned");
  assert.equal(p.canPost(actor({ suspended: true }), member, comm(), live).ok, false, "suspended");
  assert.equal(p.canPost(actor(), member, comm({ status: "archived" }), live).ok, false, "archived");
  assert.equal(p.canPost(actor(), mod, comm({ status: "archived" }), live).ok, false, "archived, moderator");
  assert.equal(p.canPost(actor(), member, comm(), { postingPaused: true }).ok, false, "paused");
  assert.equal(p.canPost(actor({ superAdmin: true }), null, comm(), live).ok, true, "superadmin");
});

test("permissions: own content", () => {
  assert.equal(p.canEditOwn(actor(), member, comm(), live, U1).ok, true);
  assert.equal(p.canEditOwn(actor(), member, comm(), live, U2).ok, false);
  assert.equal(p.canEditOwn(actor(), member, comm(), { postingPaused: true }, U1).ok, true, "edit while paused is allowed");
  assert.equal(p.canEditOwn(actor(), banned, comm(), live, U1).ok, false);
});

test("permissions: moderation", () => {
  assert.equal(p.canModerateContent(actor(), member, comm()).ok, false);
  assert.equal(p.canModerateContent(actor(), mod, comm()).ok, true);
  assert.equal(p.canModerateContent(actor(), mod, comm({ status: "archived" })).ok, false);
  assert.equal(p.canModerateContent(actor({ superAdmin: true }), null, comm({ status: "archived" })).ok, true);
  assert.equal(p.canAssignModerators(actor()).ok, false);
  assert.equal(p.canAssignModerators(actor({ superAdmin: true })).ok, true);
  assert.equal(p.canSeeReports(actor(), mod).ok, true);
  assert.equal(p.canSeeReports(actor(), member).ok, false);
});

test("permissions: direct messages, leave", () => {
  assert.equal(p.canDirectMessage(actor(), { id: U2 }, { blockedByTarget: false }).ok, true);
  assert.equal(p.canDirectMessage(actor(), { id: U1 }, { blockedByTarget: false }).ok, false);
  assert.equal(p.canDirectMessage(actor(), { id: U2 }, { blockedByTarget: true }).ok, false);
  assert.equal(p.canDirectMessage(actor({ suspended: true }), { id: U2 }, { blockedByTarget: false }).ok, false);
  assert.equal(p.canDirectMessage(null, { id: U2 }, { blockedByTarget: false }).ok, false);
  assert.equal(p.canLeave(member, { isDefault: true }).ok, false);
  assert.equal(p.canLeave(member, { isDefault: false }).ok, true);
});

test("rich posts: highlights and cover", () => {
  const blocks = [
    { type: "hero", settings: { headline: "x" } },
    { type: "form", settings: {} },
    { type: "cards", settings: { items: [{ image: { url: "/a.webp", variants: [{ w: 480, url: "/a-480.webp" }] } }] } },
    { type: "countdown", settings: {} },
    { type: "form", settings: {} },
  ];
  assert.deepEqual(highlightsOf(blocks).map((h) => h.label), ["Form", "Countdown"]);
  assert.equal(coverOf(blocks), "/a-480.webp");
  assert.equal(coverOf([{ type: "text", settings: {} }]), "");
});

test("permissions: pin, comments off, category, rich", () => {
  const su = actor({ superAdmin: true });
  assert.equal(p.canPin(actor()).ok, false);
  assert.equal(p.canPin(su).ok, true);
  assert.equal(p.canBuildRich(actor()).ok, false);
  assert.equal(p.canLockComments(su).ok, true);
  assert.equal(p.canChangeCategory(actor(), member, comm(), live, U1).ok, true, "author");
  assert.equal(p.canChangeCategory(actor(), member, comm(), live, U2).ok, false, "someone else");
  assert.equal(p.canChangeCategory(su, null, comm(), live, U2).ok, true, "SuperAdmin");
  assert.equal(p.canReact(actor(), member, comm(), { postingPaused: true }).ok, true);
});
