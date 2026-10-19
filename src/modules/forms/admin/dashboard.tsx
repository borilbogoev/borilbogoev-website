"use client";

import { useEffect, useState } from "react";
import type { Dashboard } from "../lib/stats";
import { api, BarChart, fmtDuration, fmtNum, HBars, Icon, LineChart, RangePicker, useFormatters, useToast, type Range } from "./ui";

const INK = "#111111";
const GREY = "#9A9A9A";

function delta(cur: number, prev: number) {
  if (!prev) return cur ? <span className="bbfa-delta is-up">new</span> : null;
  const d = Math.round(((cur - prev) / prev) * 100);
  return <span className={`bbfa-delta ${d >= 0 ? "is-up" : "is-down"}`}>{d >= 0 ? "▲" : "▼"} {Math.abs(d)}%</span>;
}

function Card({ title, eyebrow, wide, head, children }: { title: string; eyebrow?: string; wide?: boolean; head?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={`bbfa-card bbfa-chart-card${wide ? " is-wide" : ""}`}>
      <div className="bbfa-card__head">
        {eyebrow ? <div className="bbfa-eyebrow">{eyebrow}</div> : null}
        <h3>{title}</h3>
        {head}
      </div>
      {children}
    </div>
  );
}

export function DashboardView({ formId, accent }: { formId: number; accent: string }) {
  const toast = useToast();
  const f = useFormatters();
  const [range, setRange] = useState<Range>(() => ({ preset: "30", ...rangeFor30(f.today()) }));
  const [interval, setIntervalState] = useState<"day" | "week" | "month">("day");
  const [cumulative, setCumulative] = useState(false);
  const key = `${range.from}|${range.to}|${interval}`;
  const [result, setResult] = useState<{ key: string; data: Dashboard } | null>(null);
  const data = result?.data ?? null;
  const loading = result?.key !== key;

  useEffect(() => {
    let alive = true;
    api<Dashboard>(`forms/${formId}/stats`, { query: { from: range.from, to: range.to, interval } })
      .then((d) => alive && setResult({ key, data: d }))
      .catch((e) => alive && toast(e instanceof Error ? e.message : "Could not load analytics", "error"));
    return () => {
      alive = false;
    };
  }, [formId, range.from, range.to, interval, key, toast]);

  const fmtDay = (s: string) => {
    const d = new Date(`${s}T00:00:00Z`);
    const mon = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    return data?.range.interval === "month" ? `${mon} ${String(d.getUTCFullYear()).slice(2)}` : `${mon} ${d.getUTCDate()}`;
  };

  return (
    <div>
      <div className="bbfa-toolbar bbfa-section">
        <div>
          <div className="bbfa-eyebrow">Analytics</div>
          <h2 className="bbfa-h2">Dashboard</h2>
        </div>
        <span className="bbfa-spacer" />
        <RangePicker value={range} onChange={setRange} />
        <div className="bbfa-seg">
          {(["day", "week", "month"] as const).map((i) => (
            <button key={i} type="button" className={interval === i ? "is-active" : ""} onClick={() => setIntervalState(i)}>
              {i.charAt(0).toUpperCase() + i.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="bbfa-loading">Loading analytics...</div>
      ) : (
        <div className={`bbfa-dash${loading ? " is-loading" : ""}`}>
          <Body d={data} accent={accent} cumulative={cumulative} setCumulative={setCumulative} fmtDay={fmtDay} />
        </div>
      )}
    </div>
  );
}

function rangeFor30(today: string) {
  const [y, m, d] = today.split("-").map(Number);
  const from = new Date(y, m - 1, d - 29);
  const p = (n: number) => String(n).padStart(2, "0");
  return { from: `${from.getFullYear()}-${p(from.getMonth() + 1)}-${p(from.getDate())}`, to: today };
}

function Body({ d, accent, cumulative, setCumulative, fmtDay }: { d: Dashboard; accent: string; cumulative: boolean; setCumulative: (v: boolean) => void; fmtDay: (s: string) => string }) {
  const c = d.cards;
  const tl = d.timeline;
  const tot = c.responses || 1;
  const minis: [string, string, string][] = [
    ["Views", fmtNum(c.views), "form impressions"],
    ["Starts", fmtNum(c.starts), "first interaction"],
    ["Per day", String(c.per_day), "average responses"],
    ["All time", fmtNum(c.total_all), "total responses"],
  ];
  if (c.unique !== null) minis.push(["Unique respondents", fmtNum(c.unique), "distinct emails"]);
  for (const ch of d.charts) {
    if (ch.nps !== undefined) minis.push([`NPS · ${ch.label}`, `${ch.nps > 0 ? "+" : ""}${ch.nps}`, "promoters minus detractors"]);
    else if (ch.avg !== undefined && ch.avg !== null) minis.push([`Avg · ${ch.label}`, `${ch.avg} / ${ch.max}`, `${ch.answered} ratings`]);
  }
  for (const n of d.numbers) if (n.n) minis.push([`Sum · ${n.label}`, `${fmtNum(n.sum)}${n.unit ? ` ${n.unit}` : ""}`, `avg ${fmtNum(n.avg)} · min ${fmtNum(n.min)} · max ${fmtNum(n.max)}`]);
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

  return (
    <>
      {!c.responses ? (
        <div className="bbfa-empty is-inline">
          <div className="bbfa-empty__icon">
            <Icon name="inbox" />
          </div>
          <h3>No responses in this period</h3>
          <p>Share the form or widen the date range to see analytics.</p>
        </div>
      ) : null}
      <section className="bbfa-band is-dash">
        <div className="bbfa-kpi">
          <strong>{fmtNum(c.responses)}</strong>
          <span>Responses</span>
          <small>
            vs previous {c.days}d {delta(c.responses, c.prev)}
          </small>
        </div>
        <div className="bbfa-kpi">
          <strong>{c.completion === null ? "–" : <>{c.completion}<i>%</i></>}</strong>
          <span>Completion rate</span>
          <small>responses / starts</small>
        </div>
        <div className="bbfa-kpi">
          <strong>{c.conversion === null ? "–" : <>{c.conversion}<i>%</i></>}</strong>
          <span>Conversion rate</span>
          <small>responses / views</small>
        </div>
        <div className="bbfa-kpi">
          <strong>{fmtDuration(c.avg_time)}</strong>
          <span>Avg. time to complete</span>
          <small>from first interaction</small>
        </div>
      </section>

      <div className="bbfa-minis">
        {minis.map((m) => (
          <div className="bbfa-mini-card" key={m[0]}>
            <span>{m[0]}</span>
            <strong>{m[1]}</strong>
            <small>{m[2]}</small>
          </div>
        ))}
      </div>

      <Card
        title="Responses over time"
        eyebrow={`Timeline · by ${d.range.interval}`}
        wide
        head={
          <label className="bbfa-toggle is-sm">
            <input type="checkbox" checked={cumulative} onChange={(e) => setCumulative(e.target.checked)} />
            <span className="bbfa-toggle__ui" />
            <span className="bbfa-label">Cumulative</span>
          </label>
        }
      >
        <LineChart height={280} labels={tl.labels} labelFmt={fmtDay} series={[{ name: cumulative ? "Total responses" : "Responses", data: cumulative ? tl.cumulative : tl.responses, color: accent }]} />
      </Card>

      <div className="bbfa-dash-grid">
        <Card
          title="Views → starts → responses"
          eyebrow="Funnel over time"
          head={
            <div className="bbfa-legend">
              <span><i style={{ background: GREY }} />Views</span>
              <span><i style={{ background: INK }} />Starts</span>
              <span><i style={{ background: accent }} />Responses</span>
            </div>
          }
        >
          <LineChart labels={tl.labels} labelFmt={fmtDay} series={[{ name: "Views", data: tl.views, color: GREY, area: false, dash: true }, { name: "Starts", data: tl.starts, color: INK, area: false }, { name: "Responses", data: tl.responses, color: accent }]} />
        </Card>
        <Card title="Average completion time" eyebrow={`Timeline · by ${d.range.interval}`}>
          <LineChart labels={tl.labels} labelFmt={fmtDay} fmt={(v) => fmtDuration(Math.round(v))} series={[{ name: "Avg. time", data: tl.duration, color: INK }]} />
        </Card>
        <Card title="Responses by weekday" eyebrow="Distribution">
          <BarChart labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]} data={d.weekday} color={accent} unit="responses" />
        </Card>
        <Card title="Responses by hour of day" eyebrow="Distribution">
          <BarChart labels={hours} tipLabels={hours.map((x) => `${x}:00 – ${x}:59`)} data={d.hours} color={accent} unit="responses" />
        </Card>
        <Card title="Devices" eyebrow="Audience">
          {d.devices.length ? <HBars items={d.devices.map((x) => ({ label: x.label, n: x.n, pct: Math.round((x.n / tot) * 1000) / 10 }))} /> : <p className="bbfa-muted">No data yet.</p>}
        </Card>
        <Card title="Traffic sources" eyebrow="Audience">
          {d.channels.length ? <HBars items={d.channels.map((x) => ({ label: x.label, n: x.n, pct: Math.round((x.n / tot) * 1000) / 10 }))} /> : <p className="bbfa-muted">No data yet.</p>}
        </Card>
      </div>

      {d.rates.length ? (
        <Card title="Answer rate per question" eyebrow="Field completion" wide>
          <HBars items={d.rates} />
        </Card>
      ) : null}

      {d.charts.length ? (
        <>
          <div className="bbfa-section__head is-sub">
            <div>
              <div className="bbfa-eyebrow">Answers</div>
              <h2>Question breakdown</h2>
            </div>
          </div>
          <div className="bbfa-dash-grid">
            {d.charts.map((ch) => (
              <Card key={ch.key} title={ch.label} eyebrow={ch.key}>
                <div className="bbfa-chart-meta">
                  <span className="bbfa-chip">{fmtNum(ch.answered)} answered</span>
                  {ch.multiple ? <span className="bbfa-chip">multiple choice</span> : null}
                  {ch.avg !== undefined && ch.avg !== null ? <span className="bbfa-chip is-key">avg {ch.avg}</span> : null}
                  {ch.nps !== undefined ? <span className="bbfa-chip is-logic">NPS {ch.nps > 0 ? "+" : ""}{ch.nps}</span> : null}
                </div>
                <HBars items={ch.items} />
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
