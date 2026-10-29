// Who a person is, as other members may see it: never the email.
import { inArray } from "drizzle-orm";
import { schema } from "@/db";
import { db } from "./core";

const { users } = schema;

export type Person = { id: string; name: string; username: string; avatarUrl: string };
export type People = Record<string, Person>;

export const displayName = (u: { name: string; username: string | null }) => u.name.trim() || (u.username ? `@${u.username}` : "Member");

export async function loadPeople(ids: Iterable<string>): Promise<People> {
  const list = [...new Set(ids)];
  if (!list.length) return {};
  const rows = await db().select({ id: users.id, name: users.name, username: users.username, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, list));
  const out: People = {};
  for (const r of rows) out[r.id] = { id: r.id, name: displayName(r), username: r.username ?? "", avatarUrl: r.avatarUrl ?? "" };
  return out;
}

/** Author ids plus the people mentioned in the given bodies, in one lookup. */
export async function loadPeopleFor(authorIds: string[], bodies: string[]): Promise<People> {
  const { parseMentions } = await import("../lib/text");
  const ids = new Set(authorIds);
  for (const b of bodies) for (const m of parseMentions(b)) ids.add(m.userId);
  return loadPeople(ids);
}
