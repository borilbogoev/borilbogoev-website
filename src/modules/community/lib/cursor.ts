// Stable cursors: "<createdAtIso>_<id>". Rows are ordered by (created_at, id), so ties on the timestamp never repeat or skip.

export type Cursor = { at: Date; id: number };

export function encodeCursor(row: { createdAt: Date; id: number }): string {
  return `${row.createdAt.toISOString()}_${row.id}`;
}

export function decodeCursor(raw: unknown): Cursor | null {
  if (typeof raw !== "string") return null;
  const i = raw.lastIndexOf("_");
  if (i < 1) return null;
  const at = new Date(raw.slice(0, i));
  const id = Number(raw.slice(i + 1));
  if (Number.isNaN(at.getTime()) || !Number.isInteger(id) || id < 0) return null;
  return { at, id };
}

/** Whether row `a` comes after cursor `b` in ascending (created_at, id) order. */
export function isAfter(a: Cursor, b: Cursor): boolean {
  const d = a.at.getTime() - b.at.getTime();
  return d > 0 || (d === 0 && a.id > b.id);
}
