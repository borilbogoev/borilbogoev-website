import { fieldsOf, type Block, BLOCK_TYPES } from "./blocks";
import type { ResponseRecord } from "./responses";

/** Guards against CSV formula injection when a cell starts with = + - or @. */
function safeCell(v: string): string {
  if (v !== "" && "=+-@".includes(v[0]) && !/^[+-][\d\s().\/-]+$/.test(v)) return `'${v}`;
  return v;
}

function quote(v: string, delimiter: string): string {
  return v.includes(delimiter) || /["\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function numericKeys(blocks: Block[]): string[] {
  return fieldsOf(blocks)
    .filter((f) => f.type !== "contact" && BLOCK_TYPES[f.type].numeric)
    .map((f) => f.key);
}

/** CSV of responses, with a UTF-8 BOM so Excel opens it correctly. Dates are in the forms time zone. */
export function buildCsv(blocks: Block[], items: ResponseRecord[], delimiter: string, timeZone: string, siteUrl: string): string {
  const d = delimiter === "tab" ? "\t" : delimiter;
  const fields = fieldsOf(blocks);
  const fmt = new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const head = ["ID", "#", "Submitted", "Duration (s)", "Device", "Source", "Origin", ...fields.map((f) => `${f.label} [${f.key}]`)];
  const lines = [head.map((h) => quote(h, d)).join(d)];
  for (const r of items) {
    const base = [String(r.id), String(r.seq), fmt.format(new Date(r.created_at)), String(r.duration), r.device, r.channel, r.origin];
    const vals = fields.map((f) => {
      const raw = r.values[f.key];
      let v = Array.isArray(raw) ? raw.join(", ") : (raw ?? "");
      if (f.type === "file" && v.startsWith("/")) v = `${siteUrl}${v}`;
      return v;
    });
    lines.push([...base, ...vals].map((c) => quote(safeCell(c), d)).join(d));
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
