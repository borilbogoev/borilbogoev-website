"use client";

import { fmtNum } from "@/modules/forms/admin/ui";
import "./landing-admin.css";

// One red for the leading slice, then ink and greys: the design system's single-accent rule for charts.
const COLORS = ["#C72C2C", "#1A1A1A", "#4A4A4A", "#6B6B6B", "#8F8F8F", "#B3B3B3", "#D0D0D0", "#E8E8E8"];

export type Slice = { label: string; n: number };

/** A pie (donut) with a legend that carries the numbers, so the chart is readable without colour. */
export function DonutChart({ items, caption = "total" }: { items: Slice[]; caption?: string }) {
  const total = items.reduce((s, i) => s + i.n, 0);
  if (!total) return <p className="bbfa-muted">No data yet.</p>;
  const R = 52;
  const C = 2 * Math.PI * R;
  // Start angle of each slice, computed up front so rendering stays pure.
  const starts = items.reduce<number[]>((acc, it, i) => [...acc, i === 0 ? 0 : acc[i - 1] + (items[i - 1].n / total) * C], []);
  return (
    <div className="bbfa-donut">
      <svg width="148" height="148" viewBox="0 0 148 148" role="img" aria-label={items.map((i) => `${i.label} ${fmtNum(i.n)}`).join(", ")}>
        <g transform="rotate(-90 74 74)">
          {items.map((it, idx) => {
            const len = (it.n / total) * C;
            return (
              <circle key={idx} cx="74" cy="74" r={R} fill="none" stroke={COLORS[idx % COLORS.length]} strokeWidth="22" strokeDasharray={`${Math.max(0, len - (items.length > 1 ? 1.5 : 0))} ${C}`} strokeDashoffset={-starts[idx]}>
                <title>
                  {it.label}: {fmtNum(it.n)} ({Math.round((it.n / total) * 1000) / 10}%)
                </title>
              </circle>
            );
          })}
        </g>
        <text x="74" y="76" textAnchor="middle" className="bbfa-donut__total">
          {fmtNum(total)}
        </text>
        <text x="74" y="92" textAnchor="middle" className="bbfa-donut__cap">
          {caption}
        </text>
      </svg>
      <ul>
        {items.map((it, idx) => (
          <li key={idx}>
            <i style={{ background: COLORS[idx % COLORS.length] }} />
            <span title={it.label}>{it.label}</span>
            <strong>{fmtNum(it.n)}</strong>
            <em>{Math.round((it.n / total) * 1000) / 10}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
