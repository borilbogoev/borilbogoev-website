// CSV of users with the columns the admin picked. UTF-8 with a BOM so Excel reads accents; cells that could run as a formula are neutralised.
import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db/use";
import { EXPORT_COLUMNS, isExportKey, type ExportKey, type Scope } from "../lib/filter";
import { resolveScope } from "./query";

const SELECT: Record<ExportKey, string> = {
  id: "u.id::text",
  email: "u.email",
  name: "u.name",
  username: "u.username",
  role: "u.role",
  status: "u.status",
  phone: "u.phone",
  company: "u.company",
  job_title: "u.job_title",
  country: "u.country",
  timezone: "u.timezone",
  bio: "u.bio",
  has_password: "CASE WHEN u.password_hash IS NULL THEN 'no' ELSE 'yes' END",
  last_login: "to_char(u.last_login_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI')",
  created_at: "to_char(u.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI')",
  tags: "(SELECT string_agg(t.name, '; ' ORDER BY t.name) FROM user_tag_members x JOIN user_tags t ON t.id = x.tag_id WHERE x.user_id = u.id)",
  courses: "(SELECT string_agg(c.title, '; ' ORDER BY c.title) FROM classroom_enrolments e JOIN classroom_courses c ON c.id = e.course_id WHERE e.user_id = u.id AND e.status = 'active')",
  communities: "(SELECT string_agg(c.name, '; ' ORDER BY c.name) FROM community_members m JOIN community_communities c ON c.id = m.community_id WHERE m.user_id = u.id AND m.status = 'active')",
};

const cell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula injection
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function exportCsv(scope: Scope, columns: string[]): Promise<{ csv: string; rows: number }> {
  const keys = columns.filter(isExportKey);
  if (!keys.length) throw new Error("Choose at least one column.");
  const ids = await resolveScope(scope);
  const label = (k: ExportKey) => EXPORT_COLUMNS.find((c) => c.key === k)?.label ?? k;
  const lines = [keys.map((k) => cell(label(k))).join(",")];
  const cols = sql.join(keys.map((k) => sql`${sql.raw(SELECT[k])} AS ${sql.identifier(k)}`), sql`, `);
  for (let i = 0; i < ids.length; i += 500) {
    const part = sql.join(ids.slice(i, i + 500).map((id) => sql`${id}::uuid`), sql`, `);
    const rows = rowsOf<Record<string, unknown>>(await db().execute(sql`SELECT ${cols} FROM users u WHERE u.id IN (${part}) ORDER BY u.created_at, u.id`));
    for (const r of rows) lines.push(keys.map((k) => cell(r[k])).join(","));
  }
  return { csv: `﻿${lines.join("\r\n")}\r\n`, rows: ids.length };
}
