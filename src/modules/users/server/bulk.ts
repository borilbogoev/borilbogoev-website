// Actions on many users at once (and on one: the user page calls the same code with a single id).
// Each action is a handful of set-based SQL statements (the Neon HTTP driver has no interactive transactions).
// Sensitive actions only touch people the actor may manage (`canManageUser`) and never the actor's own account.
import { sql, type SQL } from "drizzle-orm";
import { db, rowsOf } from "@/db/use";
import type { CurrentUser } from "@/modules/auth/current";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/modules/auth/password";
import { assignableRoles, canManageUser, isRole, type Role } from "@/modules/auth/roles";
import { ensureTag, resolveScope } from "./query";
import type { Scope } from "../lib/filter";

export class BulkError extends Error {
  constructor(
    readonly status: 400 | 403 | 404,
    message: string,
  ) {
    super(message);
  }
}
const bad = (m: string) => new BulkError(400, m);

export type BulkResult = { matched: number; affected: number; skipped: number; message: string; tag?: { id: number; name: string } };

const CHUNK = 500;
const list = (ids: string[]) => sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `);
async function eachChunk(ids: string[], fn: (l: SQL) => Promise<number>): Promise<number> {
  let n = 0;
  for (let i = 0; i < ids.length; i += CHUNK) n += await fn(list(ids.slice(i, i + CHUNK)));
  return n;
}
const exec = async (q: SQL) => rowsOf<Record<string, unknown>>(await db().execute(q));
const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The people among `ids` the actor may change: not themselves, and only roles the actor manages. */
async function manageable(actor: CurrentUser, ids: string[]): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const rows = await exec(sql`SELECT id, role FROM users WHERE id IN (${list(ids.slice(i, i + CHUNK))})`);
    for (const r of rows) if (String(r.id) !== actor.id && isRole(r.role) && canManageUser(actor.role, r.role as Role)) out.push(String(r.id));
  }
  return out;
}

async function mustExist(table: "classroom_courses" | "community_communities" | "user_tags", id: number | null, what: string) {
  if (!id) throw bad(`Choose a ${what}.`);
  const [r] = await exec(sql`SELECT id FROM ${sql.raw(table)} WHERE id = ${id}`);
  if (!r) throw new BulkError(404, `That ${what} no longer exists.`);
}

export async function runBulk(actor: CurrentUser, scopeIn: Scope, body: Record<string, unknown>): Promise<BulkResult> {
  const action = String(body.action ?? "");
  const all = await resolveScope(scopeIn);
  if (!all.length) throw bad("No users to change.");
  const result = (affected: number, message: string, scoped = all.length, extra: Partial<BulkResult> = {}): BulkResult => ({ matched: all.length, affected, skipped: all.length - scoped, message, ...extra });

  switch (action) {
    // ---- tags: no risk, so everyone selected is included
    case "tag_add": {
      let tag: { id: number; name: string };
      if (typeof body.newTag === "string" && body.newTag.trim()) tag = await ensureTag(body.newTag, actor.id).catch((e) => Promise.reject(bad(e.message)));
      else {
        const id = int(body.tagId);
        await mustExist("user_tags", id, "tag");
        const [t] = await exec(sql`SELECT id, name FROM user_tags WHERE id = ${id}`);
        tag = { id: Number(t.id), name: String(t.name) };
      }
      const added = await eachChunk(all, async (l) => (await exec(sql`INSERT INTO user_tag_members (tag_id, user_id) SELECT ${tag.id}, u.id FROM users u WHERE u.id IN (${l}) ON CONFLICT DO NOTHING RETURNING user_id`)).length);
      return result(added, `${plural(added, "person", "people")} added to the tag "${tag.name}"${all.length - added ? `, ${all.length - added} already had it` : ""}.`, all.length, { tag });
    }
    case "tag_remove": {
      const id = int(body.tagId);
      await mustExist("user_tags", id, "tag");
      const n = await eachChunk(all, async (l) => (await exec(sql`DELETE FROM user_tag_members WHERE tag_id = ${id} AND user_id IN (${l}) RETURNING user_id`)).length);
      return result(n, `Tag removed from ${plural(n, "person", "people")}.`);
    }

    // ---- courses
    case "course_add": {
      const courseId = int(body.courseId);
      await mustExist("classroom_courses", courseId, "course");
      const note = typeof body.note === "string" ? body.note.slice(0, 500) : "";
      const n = await eachChunk(
        all,
        async (l) =>
          (
            await exec(sql`
              INSERT INTO classroom_enrolments (user_id, course_id, status, source, amount_cents, currency, note)
              SELECT u.id, c.id, 'active', 'admin', CASE WHEN c.access = 'paid' THEN c.price_cents ELSE 0 END, c.currency, ${note}
              FROM users u CROSS JOIN classroom_courses c WHERE u.id IN (${l}) AND c.id = ${courseId}
              ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'active', source = 'admin', updated_at = now()
              WHERE classroom_enrolments.status <> 'active'
              RETURNING id`)
          ).length,
      );
      return result(n, `${plural(n, "person", "people")} enrolled${all.length - n ? `, ${all.length - n} already had access` : ""}. No email was sent.`);
    }
    case "course_remove": {
      const courseId = int(body.courseId);
      await mustExist("classroom_courses", courseId, "course");
      const n = await eachChunk(all, async (l) => (await exec(sql`UPDATE classroom_enrolments SET status = 'revoked', updated_at = now() WHERE course_id = ${courseId} AND status <> 'revoked' AND user_id IN (${l}) RETURNING id`)).length);
      return result(n, `Course access removed for ${plural(n, "person", "people")}. Their progress is kept.`);
    }

    // ---- communities
    case "community_add": {
      const communityId = int(body.communityId);
      await mustExist("community_communities", communityId, "community");
      const n = await eachChunk(all, async (l) => (await exec(sql`INSERT INTO community_members (community_id, user_id, role, status) SELECT ${communityId}, u.id, 'member', 'active' FROM users u WHERE u.id IN (${l}) ON CONFLICT (community_id, user_id) DO NOTHING RETURNING user_id`)).length);
      return result(n, `${plural(n, "person", "people")} added to the community${all.length - n ? `, ${all.length - n} were already members (banned members stay banned)` : ""}.`);
    }
    case "community_remove": {
      const communityId = int(body.communityId);
      await mustExist("community_communities", communityId, "community");
      const n = await eachChunk(all, async (l) => (await exec(sql`DELETE FROM community_members WHERE community_id = ${communityId} AND user_id IN (${l}) RETURNING user_id`)).length);
      return result(n, `${plural(n, "person", "people")} removed from the community. Their posts stay.`);
    }
    case "community_ban": {
      const communityId = int(body.communityId);
      await mustExist("community_communities", communityId, "community");
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
      const ids = await manageable(actor, all);
      const n = await eachChunk(
        ids,
        async (l) =>
          (
            await exec(sql`
              INSERT INTO community_members (community_id, user_id, role, status, banned_reason, banned_at, banned_by)
              SELECT ${communityId}, u.id, 'member', 'banned', ${reason || null}, now(), ${actor.id}::uuid FROM users u WHERE u.id IN (${l})
              ON CONFLICT (community_id, user_id) DO UPDATE SET status = 'banned', role = 'member', banned_reason = excluded.banned_reason, banned_at = now(), banned_by = excluded.banned_by
              RETURNING user_id`)
          ).length,
      );
      return result(n, `${plural(n, "person", "people")} banned from the community.`, ids.length);
    }
    case "community_unban": {
      const communityId = int(body.communityId);
      await mustExist("community_communities", communityId, "community");
      const n = await eachChunk(all, async (l) => (await exec(sql`UPDATE community_members SET status = 'active', banned_reason = NULL, banned_at = NULL, banned_by = NULL WHERE community_id = ${communityId} AND status = 'banned' AND user_id IN (${l}) RETURNING user_id`)).length);
      return result(n, `${plural(n, "person", "people")} unbanned in the community.`);
    }

    // ---- accounts (restricted to people the actor manages)
    case "ban": {
      const ids = await manageable(actor, all);
      const n = await eachChunk(ids, async (l) => (await exec(sql`UPDATE users SET status = 'disabled', session_version = session_version + 1, updated_at = now() WHERE id IN (${l}) AND status <> 'disabled' RETURNING id`)).length);
      return result(n, `${plural(n, "account")} banned. They are signed out and cannot sign in.`, ids.length);
    }
    case "unban": {
      const ids = await manageable(actor, all);
      const n = await eachChunk(ids, async (l) => (await exec(sql`UPDATE users SET status = 'active', failed_attempts = 0, locked_until = NULL, updated_at = now() WHERE id IN (${l}) AND status <> 'active' RETURNING id`)).length);
      return result(n, `${plural(n, "account")} enabled again.`, ids.length);
    }
    case "signout": {
      const ids = await manageable(actor, all);
      const n = await eachChunk(ids, async (l) => (await exec(sql`UPDATE users SET session_version = session_version + 1 WHERE id IN (${l}) RETURNING id`)).length);
      return result(n, `${plural(n, "person", "people")} signed out everywhere.`, ids.length);
    }
    case "password_reset": {
      const password = String(body.password ?? "");
      if (password.length < MIN_PASSWORD_LENGTH) throw bad(`The password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      const ids = (await manageable(actor, all)).slice(0, 300);
      let n = 0;
      for (let i = 0; i < ids.length; i += 8) {
        const batch = ids.slice(i, i + 8);
        const hashes = await Promise.all(batch.map(() => hashPassword(password))); // own salt per person
        for (let j = 0; j < batch.length; j++) {
          n += (await exec(sql`UPDATE users SET password_hash = ${hashes[j]}, session_version = session_version + 1, failed_attempts = 0, locked_until = NULL, updated_at = now() WHERE id = ${batch[j]}::uuid RETURNING id`)).length;
        }
      }
      return result(n, `Password changed for ${plural(n, "person", "people")}. They are signed out everywhere.`, ids.length);
    }
    case "role_set": {
      const role = String(body.role ?? "");
      if (!isRole(role) || !assignableRoles(actor.role).includes(role)) throw new BulkError(403, "You cannot assign this role.");
      const ids = await manageable(actor, all);
      const n = await eachChunk(ids, async (l) => (await exec(sql`UPDATE users SET role = ${role}, session_version = session_version + 1, updated_at = now() WHERE id IN (${l}) AND role <> ${role} RETURNING id`)).length);
      return result(n, `${plural(n, "person", "people")} changed to ${role}.`, ids.length);
    }
    case "delete": {
      const ids = await manageable(actor, all); // never the actor, so an active owner always remains when an owner deletes
      const n = await eachChunk(ids, async (l) => (await exec(sql`DELETE FROM users WHERE id IN (${l}) RETURNING id`)).length);
      return result(n, `${plural(n, "user")} deleted for good, with their enrolments, memberships and posts.`, ids.length);
    }
    default:
      throw bad("Unknown action.");
  }
}
