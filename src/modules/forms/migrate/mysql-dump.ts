// Reads the INSERT statements of a phpMyAdmin / mysqldump export. Only what the BB Forms WP tables need:
// single-quoted strings with backslash escapes, numbers and NULL.

export type Cell = string | number | null;
export type DumpRow = Record<string, Cell>;

const ESCAPES: Record<string, string> = { n: "\n", r: "\r", t: "\t", "0": "\0", b: "\b", Z: "\x1a", "\\": "\\", "'": "'", '"': '"' };

function parseColumns(list: string): string[] {
  return [...list.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

/** Parses all rows of every `INSERT INTO <table>` in the dump text, keyed by table name (without prefix handling). */
export function parseInserts(sql: string): Map<string, DumpRow[]> {
  const out = new Map<string, DumpRow[]>();
  const head = /INSERT INTO `([^`]+)` \(([^)]*)\) VALUES/g;
  let m: RegExpExecArray | null;
  while ((m = head.exec(sql))) {
    const table = m[1];
    const columns = parseColumns(m[2]);
    let i = head.lastIndex;
    const rows = out.get(table) ?? [];
    for (;;) {
      while (i < sql.length && /[\s,]/.test(sql[i])) i++;
      if (sql[i] !== "(") break;
      i++;
      const cells: Cell[] = [];
      for (;;) {
        while (/\s/.test(sql[i])) i++;
        if (sql[i] === "'") {
          i++;
          let s = "";
          for (;;) {
            const c = sql[i++];
            if (c === undefined) throw new Error(`Unterminated string in table ${table}.`);
            if (c === "\\") {
              const e = sql[i++];
              s += ESCAPES[e] ?? e;
            } else if (c === "'") {
              if (sql[i] === "'") {
                s += "'";
                i++;
              } else break;
            } else s += c;
          }
          cells.push(s);
        } else {
          const start = i;
          while (i < sql.length && !/[,)]/.test(sql[i])) i++;
          const token = sql.slice(start, i).trim();
          cells.push(token.toUpperCase() === "NULL" ? null : Number(token));
          if (token !== "" && token.toUpperCase() !== "NULL" && Number.isNaN(Number(token))) throw new Error(`Unexpected value "${token}" in table ${table}.`);
        }
        while (/\s/.test(sql[i])) i++;
        if (sql[i] === ",") {
          i++;
          continue;
        }
        if (sql[i] === ")") {
          i++;
          break;
        }
        throw new Error(`Unexpected character "${sql[i]}" in table ${table} near offset ${i}.`);
      }
      if (cells.length !== columns.length) throw new Error(`Row has ${cells.length} values but ${columns.length} columns in table ${table}.`);
      rows.push(Object.fromEntries(columns.map((c, k) => [c, cells[k]])));
    }
    out.set(table, rows);
  }
  return out;
}
