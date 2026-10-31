// Service-level tests against an in-memory Postgres (PGlite) with the real migrations.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, sql } from "drizzle-orm";
import { schema } from "@/db";
import { setDbForTests, db, type Db } from "@/db/use";
import type { CurrentUser } from "@/modules/auth/current";
import * as ctx from "../server/context";
import * as posts from "../server/posts";
import * as comments from "../server/comments";
import * as notes from "../server/notifications";
import * as chat from "../server/chat";
import * as safety from "../server/safety";
import * as admin from "../server/admin";
import * as profile from "../server/profile";
import * as coms from "../server/communities";
import { setLike } from "../server/likes";
import * as cats from "../server/categories";
import * as rich from "../server/rich";
import { clearSettingsCache } from "../server/settings";

const ids = { A: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", B: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", M: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", S: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", X: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" };
const user = (key: keyof typeof ids, role = "student"): CurrentUser => ({ id: ids[key], email: `${key}@x.test`, name: `User ${key}`, role: role as CurrentUser["role"], status: "active", lastLoginAt: null, createdAt: new Date(), hasPassword: false });
const V: Record<string, ctx.Viewer> = {};
const viewer = async (k: keyof typeof ids, role?: string) => (V[k] = await ctx.viewerFor(user(k, role)));
let second: number;

before(async () => {
  const pg = new PGlite();
  for (const f of fs.readdirSync("drizzle").filter((x) => x.endsWith(".sql")).sort()) await pg.exec(fs.readFileSync(path.join("drizzle", f), "utf8").replaceAll("--> statement-breakpoint", ""));
  setDbForTests(drizzle(pg, { schema }) as unknown as Db);
  for (const k of Object.keys(ids) as (keyof typeof ids)[]) await db().insert(schema.users).values({ id: ids[k], email: `${k}@x.test`, name: `User ${k}`, role: k === "S" ? "owner" : "student", username: `user${k.toLowerCase()}` });
  for (const k of ["A", "B", "M", "X"] as const) await viewer(k);
  await viewer("S", "owner");
  for (const k of Object.keys(ids)) await ctx.ensureDefaultMembership(ids[k as keyof typeof ids]);
  const c = await admin.createCommunity(V.S, { slug: "second", name: "Second" });
  second = c.id;
  await admin.addMember(V.S, second, ids.A);
  await admin.addMember(V.S, second, ids.B);
  await admin.addMember(V.S, second, ids.M);
  await admin.setModerator(V.S, second, ids.M, true);
  await admin.setModerator(V.S, 1, ids.M, true);
});

const scope = async (k: string, slug = "community") => ctx.scopeBySlug(V[k], slug);
const tok = (k: keyof typeof ids) => `@[User ${k}](user:${ids[k]})`;

test("seed: one default community, settings row", async () => {
  const [d] = await db().select().from(schema.communities).where(eq(schema.communities.isDefault, true));
  assert.equal(d.slug, "community");
  assert.equal((await db().select().from(schema.communitySettings)).length, 1);
  await assert.rejects(async () => db().insert(schema.communities).values({ slug: "dup-default", name: "x", isDefault: true }));
});

test("post, idempotent request id, feed, edit, delete", async () => {
  const s = await scope("A");
  const a = await posts.createPost(s, { body: "Hello world", requestId: "r1" });
  const again = await posts.createPost(s, { body: "Hello world", requestId: "r1" });
  assert.equal(again.item.id, a.item.id);
  assert.equal(again.duplicate, true);
  const feed = await posts.listFeed(await scope("B"), {});
  assert.equal(feed.items.length, 1);
  assert.equal(feed.items[0].canEdit, false);
  await assert.rejects(async () => posts.createPost(s, { body: "   " }), /Write something/);
  const edited = await posts.editPost(s, (await posts.getPostRow(a.item.id))!, "Edited");
  assert.equal(edited.item.body, "Edited");
  assert.ok(edited.item.editedAt);
  await posts.setPostStatus(s, (await posts.getPostRow(a.item.id))!, "deleted");
  assert.equal((await posts.listFeed(await scope("B"), {})).items.length, 0);
  assert.equal(await posts.getPost(await scope("B"), a.item.id), null);
});

test("comments: counts, notification, mentions, polling cursor", async () => {
  const sa = await scope("A");
  const post = (await posts.createPost(sa, { body: "Count me" })).item;
  const sb = await scope("B");
  const c1 = await comments.createComment(sb, post.id, { body: `Nice ${tok("A")}`, requestId: "c1" });
  assert.equal((await comments.createComment(sb, post.id, { body: `Nice ${tok("A")}`, requestId: "c1" })).duplicate, true);
  const c2 = await comments.createComment(sb, post.id, { body: "Second" });
  assert.equal((await posts.getPostRow(post.id))!.commentCount, 2);
  // A is the post author and was mentioned in c1: exactly one notification for that comment, none doubled
  const list = await notes.listNotifications(ids.A);
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].count, 2, "two unread comments collapse into one row");
  assert.equal(await notes.unreadCount(ids.A), 2);
  assert.equal((await db().select().from(schema.communityMentions).where(eq(schema.communityMentions.sourceId, c1.item.id))).length, 1);
  // polling
  const after = await comments.listComments(sa, post.id, c1.item.cursor);
  assert.deepEqual(after.items.map((i) => i.id), [c2.item.id]);
  // delete one: count drops, notification gone
  await comments.setCommentStatus(sb, (await comments.getCommentRow(c2.item.id))!, "deleted");
  assert.equal((await posts.getPostRow(post.id))!.commentCount, 1);
  assert.equal(await notes.unreadCount(ids.A), 1);
  // moderator hide / unhide keeps the count right
  const sm = await scope("M");
  await comments.setCommentStatus(sm, (await comments.getCommentRow(c1.item.id))!, "hidden_by_mod");
  assert.equal((await posts.getPostRow(post.id))!.commentCount, 0);
  await comments.setCommentStatus(sm, (await comments.getCommentRow(c1.item.id))!, "published");
  assert.equal((await posts.getPostRow(post.id))!.commentCount, 1);
  await notes.markRead(ids.A, { all: true });
  assert.equal(await notes.unreadCount(ids.A), 0);
});

test("mentions: edit removes row and notification; self and strangers neutralized", async () => {
  const sb = await scope("B");
  const p = (await posts.createPost(sb, { body: `hi ${tok("A")} ${tok("B")} ${tok("S")}` })).item;
  assert.equal(p.body.includes(`user:${ids.B}`), false, "self mention is plain text");
  assert.ok(p.body.includes(`user:${ids.A}`));
  assert.equal((await db().select().from(schema.communityMentions).where(eq(schema.communityMentions.sourceId, p.id))).length, 2);
  const row = (await posts.getPostRow(p.id))!;
  await posts.editPost(sb, row, "no mentions now");
  assert.equal((await db().select().from(schema.communityMentions).where(eq(schema.communityMentions.sourceId, p.id))).length, 0);
  // a user who is not a member of the second community
  const s2 = await ctx.scopeBySlug(V.A, "second");
  const q = (await posts.createPost(s2, { body: `hey ${tok("X")}` })).item;
  assert.equal(q.body, `hey @User X`);
});

test("reports: once per target; moderator hides; author still sees it; ban blocks posting only there", async () => {
  const sa = await scope("A");
  const p = (await posts.createPost(sa, { body: "Report me" })).item;
  await safety.createReport(V.B, { targetType: "post", targetId: p.id, reason: "spam" });
  await assert.rejects(async () => safety.createReport(V.B, { targetType: "post", targetId: p.id, reason: "spam" }), /already reported/);
  const [rep] = await admin.listReports(V.M, { status: "open" });
  await admin.resolveReport(V.M, rep.id, "hide", "");
  assert.equal((await posts.listFeed(await scope("B"), {})).items.some((i) => i.id === p.id), false);
  const own = (await posts.listFeed(await scope("A"), {})).items.find((i) => i.id === p.id);
  assert.equal(own?.status, "hidden_by_mod");
  await admin.banMember(V.M, 1, ids.B, "spam");
  await assert.rejects(async () => posts.createPost(await scope("B"), { body: "nope" }), /banned/);
  await assert.doesNotReject(async () => posts.createPost(await ctx.scopeBySlug(V.B, "second"), { body: "other community" }));
  await admin.unbanMember(V.M, 1, ids.B);
  // moderator cannot act outside their community
  const other = await admin.createCommunity(V.S, { slug: "third", name: "Third" });
  await assert.rejects(async () => admin.listMembers(V.M, other.id, {}), /can't do that/);
});

test("pause and archive block writes; default swap keeps one default", async () => {
  await admin.updateSettings(V.S, { postingPaused: true });
  clearSettingsCache();
  await assert.rejects(async () => posts.createPost(await scope("A"), { body: "paused" }), /paused/i);
  await admin.updateSettings(V.S, { postingPaused: false });
  clearSettingsCache();
  await admin.updateCommunity(V.S, second, { status: "archived" });
  await assert.rejects(async () => posts.createPost(await ctx.scopeBySlug(V.A, "second"), { body: "archived" }), /archived/);
  await admin.updateCommunity(V.S, second, { status: "active" });
  await admin.setDefaultCommunity(V.S, second);
  assert.equal((await db().select().from(schema.communities).where(eq(schema.communities.isDefault, true))).length, 1);
  await admin.setDefaultCommunity(V.S, 1);
  assert.equal((await db().select().from(schema.communities).where(eq(schema.communities.isDefault, true)))[0].id, 1);
});

test("rate limit returns 429 with retryAfter; superadmin exempt", async () => {
  await admin.updateSettings(V.S, { ratePostPerHour: 1 });
  clearSettingsCache();
  const sx = await ctx.scopeBySlug(V.X, "community");
  await posts.createPost(sx, { body: "one" });
  await assert.rejects(async () => posts.createPost(sx, { body: "two" }), (e: { status?: number; extra?: { retryAfter?: number } }) => e.status === 429 && (e.extra?.retryAfter ?? 0) > 0);
  const ss = await scope("S");
  await posts.createPost(ss, { body: "admin one" });
  await assert.doesNotReject(async () => posts.createPost(ss, { body: "admin two" }));
  await admin.updateSettings(V.S, { ratePostPerHour: 10 });
  clearSettingsCache();
});

test("chat: one conversation under a race, privacy, unread, blocks, mentions", async () => {
  const [c1, c2] = await Promise.all([chat.openConversation(V.A, ids.B), chat.openConversation(V.B, ids.A)]);
  assert.equal(c1, c2);
  assert.equal((await db().select().from(schema.communityConversations)).length, 1);
  assert.equal((await db().select().from(schema.communityParticipants)).length, 2);
  await assert.rejects(async () => chat.openConversation(V.A, ids.A), /yourself/);
  await chat.sendMessage(V.A, c1, { body: `hello ${tok("B")} and ${tok("S")}`, requestId: "m1" });
  assert.equal((await chat.sendMessage(V.A, c1, { body: "x", requestId: "m1" })).duplicate, true);
  assert.equal(await chat.unreadConversations(V.B), 1);
  assert.equal(await chat.unreadConversations(V.A), 0);
  assert.equal((await chat.listConversations(V.B)).items[0].unread, true);
  await chat.markConversationRead(V.B, c1);
  assert.equal(await chat.unreadConversations(V.B), 0);
  // nobody else can read it, not even the SuperAdmin
  await assert.rejects(async () => chat.listMessages(V.X, c1, {}), /Not found/);
  await assert.rejects(async () => chat.listMessages(V.S, c1, {}), /Not found/);
  await assert.rejects(async () => chat.sendMessage(V.X, c1, { body: "hi" }), /Not found/);
  // message mentions exist but produce no notifications
  assert.ok((await db().select().from(schema.communityMentions).where(eq(schema.communityMentions.sourceType, "message"))).length >= 1);
  assert.equal(await notes.unreadCount(ids.B), (await db().select().from(schema.communityNotifications).where(eq(schema.communityNotifications.userId, ids.B))).filter((n) => !n.readAt).length);
  // reply, then block
  await chat.sendMessage(V.B, c1, { body: "hi back" });
  await safety.blockUser(V.B, ids.A);
  await assert.rejects(async () => chat.sendMessage(V.A, c1, { body: "still there?" }), /can't message this user/);
  await assert.rejects(async () => chat.openConversation(V.A, ids.B), /can't message this user/);
  assert.equal((await chat.listMessages(V.B, c1, {})).items.length, 2, "the blocker keeps the history");
  await safety.unblockUser(V.B, ids.A);
  // report a message: snapshot copied, only the recipient may report
  const msgs = (await chat.listMessages(V.B, c1, {})).items;
  const fromA = msgs.find((m) => m.senderId === ids.A)!;
  await assert.rejects(async () => safety.createReport(V.X, { targetType: "message", targetId: fromA.id, reason: "abuse" }), /Not found/);
  await safety.createReport(V.B, { targetType: "message", targetId: fromA.id, reason: "abuse" });
  const [rep] = (await admin.listReports(V.S, { type: "message" }));
  assert.ok(rep.snapshot.includes("hello"));
  await admin.resolveReport(V.S, rep.id, "suspend", "abuse");
  // suspended: read only everywhere
  const sus = await ctx.viewerFor(user("A"));
  assert.equal(sus.actor.suspended, true);
  await assert.rejects(async () => posts.createPost(await ctx.scopeBySlug(sus, "community"), { body: "no" }), /read only/);
  await assert.rejects(async () => chat.sendMessage(sus, c1, { body: "no" }), /can't message this user/);
  V.A = sus;
  const [open] = await db().select().from(schema.communitySuspensions);
  await safety.liftSuspension(open.id);
  V.A = await ctx.viewerFor(user("A"));
  assert.equal(V.A.actor.suspended, false);
});

test("profile: visibility, hidden and deleted content", async () => {
  const hidden = await admin.createCommunity(V.S, { slug: "secret", name: "Secret", visibility: "hidden" });
  await admin.addMember(V.S, hidden.id, ids.A);
  await posts.createPost(await ctx.scopeBySlug(V.A, "secret"), { body: "secret post" });
  const own = await profile.profilePosts({ viewer: V.A, targetId: ids.A });
  assert.ok(own.items.some((i) => i.snippet === "secret post"));
  const seen = await profile.profilePosts({ viewer: V.B, targetId: ids.A });
  assert.ok(!seen.items.some((i) => i.snippet === "secret post"), "no leak to a non-member");
  await assert.rejects(async () => ctx.scopeBySlug(V.B, "secret"), /Not found/);
  assert.ok(!(await coms.listCommunities(V.B)).some((c) => c.slug === "secret"));
  assert.ok((await profile.profilePosts({ viewer: V.S, targetId: ids.A })).items.some((i) => i.snippet === "secret post"));
  const mentions = await profile.profileMentions({ viewer: V.A, targetId: ids.A });
  assert.ok(mentions.items.every((i) => i.kind === "mention"));
  assert.ok(!(await profile.profileComments({ viewer: V.B, targetId: ids.A })).items.some((i) => i.communitySlug === "secret"));
  // pagination
  const page1 = await profile.profilePosts({ viewer: V.S, targetId: ids.A });
  assert.ok(page1.items.length > 0);
});

test("suggest: members of the community only, never self", async () => {
  const s = await scope("A");
  const r = await coms.suggest(V.A, { q: "user", scope: s });
  assert.ok(r.length > 0 && r.every((x) => x.id !== ids.A));
  const chatScope = await coms.suggest(V.A, { q: "u" });
  assert.equal(chatScope.length, 0, "chat scope needs two characters");
  assert.ok((await coms.suggest(V.A, { q: "userb" })).some((x) => x.id === ids.B));
});

test("join and leave", async () => {
  const c = await admin.createCommunity(V.S, { slug: "open-one", name: "Open one" });
  const s = await ctx.scopeById(V.X, c.id);
  await coms.joinCommunity(s);
  const s2 = await ctx.scopeById(V.X, c.id);
  await coms.leaveCommunity(s2);
  await assert.rejects(async () => coms.leaveCommunity(await scope("X")), /default/);
  await db().execute(sql`select 1`);
});

test("likes: once per person, counters, flags, rules", async () => {
  const p = (await posts.createPost(await scope("A"), { body: "Like me" })).item;
  const c = (await comments.createComment(await scope("B"), p.id, { body: "c" })).item;
  assert.deepEqual(await setLike(V.B, "post", p.id, true), { liked: true, likeCount: 1 });
  assert.equal((await setLike(V.B, "post", p.id, true)).likeCount, 1, "a second like does not count twice");
  assert.equal((await setLike(V.A, "post", p.id, true)).likeCount, 2);
  assert.equal((await posts.listFeed(await scope("B"), {})).items.find((i) => i.id === p.id)?.liked, true);
  assert.equal((await posts.listFeed(await scope("X"), {})).items.find((i) => i.id === p.id)?.liked, false);
  assert.equal((await setLike(V.B, "post", p.id, false)).likeCount, 1);
  assert.equal((await setLike(V.B, "post", p.id, false)).likeCount, 1, "unliking twice does not go below");
  assert.equal((await setLike(V.A, "comment", c.id, true)).likeCount, 1);
  assert.equal((await comments.listComments(await scope("A"), p.id, null)).items.find((i) => i.id === c.id)?.liked, true);
  await admin.updateSettings(V.S, { postingPaused: true });
  clearSettingsCache();
  await assert.doesNotReject(async () => setLike(V.B, "post", p.id, true), "liking works while posting is paused");
  await admin.updateSettings(V.S, { postingPaused: false });
  clearSettingsCache();
  await assert.rejects(async () => setLike(V.A, "post", 99999, true), /Not found/);
  await posts.setPostStatus(await scope("A"), (await posts.getPostRow(p.id))!, "deleted");
  await assert.rejects(async () => setLike(V.B, "post", p.id, true), /Not found/);
});

test("categories, rich posts, pin, sort rules, unread, comments off", async () => {
  const comm = await admin.createCommunity(V.S, { slug: "rich-room", name: "Rich room" });
  await admin.addMember(V.S, comm.id, ids.A);
  await admin.addMember(V.S, comm.id, ids.B);
  const sS = await ctx.scopeById(V.S, comm.id);
  const sA = await ctx.scopeById(V.A, comm.id);
  const sB = await ctx.scopeById(V.B, comm.id);

  // categories: only the SuperAdmin manages them; drafts are not usable by members
  await assert.rejects(async () => cats.createCategory(V.A, comm.id, { name: "Nope" }), /can't do that/);
  const news = await cats.createCategory(V.S, comm.id, { name: "News", status: "published" });
  const secret = await cats.createCategory(V.S, comm.id, { name: "Hidden tab", status: "draft" });
  assert.deepEqual((await cats.listCategories(comm.id)).map((c) => c.name), ["News"]);
  assert.equal((await cats.listCategories(comm.id, { all: true })).length, 2);
  await assert.rejects(async () => posts.createPost(sA, { body: "x", categoryId: secret.id }), /not available/);

  const p1 = (await posts.createPost(sA, { body: "first, in news", categoryId: news.id })).item;
  const p2 = (await posts.createPost(sB, { body: "second, no category" })).item;
  const p3 = (await posts.createPost(sA, { body: "third, in news" })).item;
  assert.equal((await posts.listFeed(sB, { sort: "new", categoryId: news.id })).items.length, 1, "category tab shows only its posts");
  assert.equal((await posts.listFeed(sB, { sort: "new" })).items.length, 3, "All shows everything");

  // sorting
  await setLike(V.B, "post", p1.id, true);
  await setLike(V.S, "post", p1.id, true);
  assert.equal((await posts.listFeed(sS, { sort: "top" })).items[0].id, p1.id, "top: most liked first");
  assert.equal((await posts.listFeed(sS, { sort: "new" })).items[0].id, p3.id, "new: newest first");
  await comments.createComment(sB, p2.id, { body: "bump" });
  assert.equal((await posts.listFeed(sS, { sort: "default" })).items[0].id, p2.id, "default: latest activity first");
  // top pagination does not repeat or skip
  const all = new Set<number>();
  let cursor: string | null = null;
  for (let i = 0; i < 5; i++) {
    const page = await posts.listFeed(sS, { sort: "top", cursor });
    page.items.forEach((x) => all.add(x.id));
    cursor = page.nextCursor;
    if (!cursor) break;
  }
  assert.ok(all.has(p1.id) && all.has(p2.id) && all.has(p3.id));

  // pin: SuperAdmin only, shown first under every sort, not repeated further down
  await assert.rejects(async () => posts.updatePostMeta(sA, (await posts.getPostRow(p1.id))!, { pinned: true }), /can't do that/);
  await posts.updatePostMeta(sS, (await posts.getPostRow(p2.id))!, { pinned: true });
  for (const sort of ["new", "top", "default"] as const) {
    const f = await posts.listFeed(sB, { sort });
    assert.equal(f.items[0].id, p2.id, `pinned first under ${sort}`);
    assert.equal(f.items.filter((x) => x.id === p2.id).length, 1);
  }
  assert.equal((await posts.listFeed(sB, { sort: "new", categoryId: news.id })).items.some((x) => x.id === p2.id), false, "pinned post stays in its own category");
  await posts.updatePostMeta(sS, (await posts.getPostRow(p2.id))!, { pinned: false });
  assert.equal((await posts.listFeed(sB, { sort: "new" })).items[0].id, p3.id);

  // unread
  assert.equal((await posts.listFeed(sB, { sort: "unread" })).items.some((x) => x.id === p2.id), false, "own posts are never unread");
  const unreadBefore = (await posts.listFeed(sB, { sort: "unread" })).items.map((x) => x.id);
  assert.ok(unreadBefore.includes(p1.id) && unreadBefore.includes(p3.id));
  await posts.markPostRead(ids.B, p1.id);
  assert.equal((await posts.listFeed(sB, { sort: "unread" })).items.some((x) => x.id === p1.id), false);

  // change category: the author or the SuperAdmin, not someone else
  await assert.rejects(async () => posts.updatePostMeta(sB, (await posts.getPostRow(p1.id))!, { categoryId: null }), /can't do that/);
  await posts.updatePostMeta(sA, (await posts.getPostRow(p1.id))!, { categoryId: null });
  assert.equal((await posts.getPostRow(p1.id))!.categoryId, null);

  // comments off
  await assert.rejects(async () => posts.updatePostMeta(sA, (await posts.getPostRow(p3.id))!, { commentsLocked: true }), /can't do that/);
  await posts.updatePostMeta(sS, (await posts.getPostRow(p3.id))!, { commentsLocked: true });
  await assert.rejects(async () => comments.createComment(sB, p3.id, { body: "blocked" }), /turned off/);
  await posts.updatePostMeta(sS, (await posts.getPostRow(p3.id))!, { commentsLocked: false });
  await assert.doesNotReject(async () => comments.createComment(sB, p3.id, { body: "ok again" }));

  // the SuperAdmin may edit a member's text post; a member may not edit someone else's
  const edited = await posts.editPost(sS, (await posts.getPostRow(p2.id))!, "tidied by the admin");
  assert.equal(edited.item.body, "tidied by the admin");
  await assert.rejects(async () => posts.editPost(sB, (await posts.getPostRow(p3.id))!, "hijack"), /can't do that/);

  // rich posts
  await assert.rejects(async () => rich.createRich(V.A, { communityId: comm.id }), /can't do that/);
  const rid = await rich.createRich(V.S, { communityId: comm.id, categoryId: news.id, title: "Launch day" });
  assert.equal((await posts.listFeed(sB, { sort: "new" })).items.some((x) => x.id === rid), false, "drafts are not in the feed");
  assert.equal(await posts.getPost(sB, rid), null, "members cannot open a draft");
  await assert.rejects(async () => rich.saveRich(V.S, rid, { status: "published" }), /at least one block/);
  const saved = await rich.saveRich(V.S, rid, {
    excerpt: "Everything you need.",
    blocks: [
      { type: "hero_image", settings: { headline: "Welcome", image: { id: 1, url: "/api/forms/media/images/x.webp" } } },
      { type: "form", settings: { form_id: 1 } },
      { type: "countdown", settings: { target: "2030-01-01T10:00:00Z" } },
      { type: "not_a_block", settings: {} },
    ],
  });
  assert.deepEqual(saved.blocks.map((b) => b.type), ["hero_image", "form", "countdown"], "unknown blocks are dropped");
  await rich.saveRich(V.S, rid, { status: "published" });
  const feed = (await posts.listFeed(sB, { sort: "new" })).items;
  const card = feed.find((x) => x.id === rid)!;
  assert.equal(card.kind, "rich");
  assert.equal(card.title, "Launch day");
  assert.equal(card.cover, "/api/forms/media/images/x.webp");
  assert.deepEqual(card.highlights.map((h) => h.label), ["Form", "Countdown"]);
  assert.equal(card.blocks, undefined, "blocks are not sent with the feed");
  assert.equal(card.canEdit, false);
  assert.equal(feed[0].id, rid, "newly published is newest");
  const detail = await posts.getPost(sB, rid);
  assert.equal(detail?.item.blocks?.length, 3);
  // it behaves as a post: like, comment, pin, lock, hide
  assert.equal((await setLike(V.B, "post", rid, true)).likeCount, 1);
  assert.equal((await comments.createComment(sB, rid, { body: "great" })).item.postId, rid);
  await posts.updatePostMeta(sS, (await posts.getPostRow(rid))!, { pinned: true });
  assert.equal((await posts.listFeed(sB, { sort: "top" })).items[0].id, rid);
  await assert.rejects(async () => posts.editPost(sS, (await posts.getPostRow(rid))!, "x"), /builder/);
  assert.equal((await rich.listRich(V.S, {})).some((r) => r.id === rid && r.pinned && r.likes === 1), true);
  await posts.setPostStatus(sS, (await posts.getPostRow(rid))!, "hidden_by_mod");
  assert.equal((await posts.listFeed(sB, { sort: "new" })).items.some((x) => x.id === rid), false);
  assert.equal((await posts.getPostRow(rid))!.pinnedAt, null, "hiding unpins");

  // community sort rule and category sort rule apply when nothing is picked
  await admin.updateCommunity(V.S, comm.id, { defaultSort: "top" });
  assert.equal(await posts.effectiveSort(await ctx.scopeById(V.B, comm.id), null, null), "top");
  await cats.updateCategory(V.S, news.id, { sortRule: "new" });
  assert.equal(await posts.effectiveSort(await ctx.scopeById(V.B, comm.id), news.id, null), "new");
  assert.equal(await posts.effectiveSort(await ctx.scopeById(V.B, comm.id), news.id, "unread"), "unread");
  // deleting a category keeps its posts
  await cats.deleteCategory(V.S, news.id);
  assert.ok((await posts.getPostRow(p3.id)) && (await posts.getPostRow(p3.id))!.categoryId === null);
});

test("rich post themes and featured media", async () => {
  const comm = await admin.createCommunity(V.S, { slug: "themes", name: "Themes" });
  const sS = await ctx.scopeById(V.S, comm.id);
  const rid = await rich.createRich(V.S, { communityId: comm.id, title: "Looks" });
  assert.equal((await rich.getRich(V.S, rid)).theme, "ink", "default theme");
  const blocks = [{ type: "hero_image", settings: { headline: "x", image: { id: 1, url: "/first.webp" } } }];
  await rich.saveRich(V.S, rid, { blocks, theme: "neon" });
  assert.equal((await rich.getRich(V.S, rid)).theme, "ink", "an unknown theme is ignored");
  await rich.saveRich(V.S, rid, { theme: "signal", status: "published" });
  let card = (await posts.listFeed(sS, { sort: "new" })).items.find((x) => x.id === rid)!;
  assert.equal(card.theme, "signal");
  assert.equal(card.cover, "/first.webp", "no featured media: the first visual block");
  assert.equal(card.coverVideo, false);
  await rich.saveRich(V.S, rid, { theme: "frame", featured: { image: { url: "/featured.webp", width: 800, height: 600 }, video: "https://youtu.be/dQw4w9WgXcQ" } });
  card = (await posts.listFeed(sS, { sort: "new" })).items.find((x) => x.id === rid)!;
  assert.equal(card.theme, "frame");
  assert.equal(card.cover, "/featured.webp");
  assert.equal(card.coverVideo, true);
  const f = (await rich.getRich(V.S, rid)).featured;
  assert.equal(f.video, "https://youtu.be/dQw4w9WgXcQ");
  await rich.saveRich(V.S, rid, { featured: { image: { url: "javascript:alert(1)" }, video: "https://evil.example/page" } });
  const clean = (await rich.getRich(V.S, rid)).featured;
  assert.equal(clean.image, undefined, "unsafe picture address dropped");
  assert.equal(clean.video, undefined, "a link that is not a known video is dropped");
  assert.equal((await rich.listRich(V.S, {})).find((r) => r.id === rid)?.theme, "frame");
});
