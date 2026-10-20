"use client";

import { useEffect, useState } from "react";
import { api, BarChart, fmtNum, Icon, LineChart, RangePicker, useFormatters, useToast, type Range } from "@/modules/forms/admin/ui";
import type { LandingDashboard } from "../lib/stats";
import { DonutChart } from "./charts";
import "./landing-admin.css";

const INK = "#1A1A1A";
const GREY = "#9A9A9A";
const RED = "#C72C2C";

function delta(cur: number, prev: number) {
  if (!prev) return cur ? <span className="bbfa-delta is-up">new</span> : null;
  const d = Math.round(((cur - prev) / prev) * 100);
  return (
    <span className={`bbfa-delta ${d >= 0 ? "is-up" : "is-down"}`}>
      {d >= 0 ? "▲" : "▼"} {Math.abs(d)}%
    </span>
  );
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

function rangeFor30(today: string) {
  const [y, m, d] = today.split("-").map(Number);
  const from = new Date(y, m - 1, d - 29);
  const p = (n: number) => String(n).padStart(2, "0");
  return { from: `${from.getFullYear()}-${p(from.getMonth() + 1)}-${p(from.getDate())}`, to: today };
}

const pct = (v: number | null) => (v === null ? "–" : `${v}%`);

export function LandingDashboardView({ pageId }: { pageId: number }) {
  const toast = useToast();
  const f = useFormatters();
  const [range, setRange] = useState<Range>(() => ({ preset: "30", ...rangeFor30(f.today()) }));
  const [interval, setIntervalState] = useState<"day" | "week" | "month">("day");
  const key = `${range.from}|${range.to}|${interval}`;
  const [result, setResult] = useState<{ key: string; data: LandingDashboard } | null>(null);
  const data = result?.data ?? null;
  const loading = result?.key !== key;

  useEffect(() => {
    let alive = true;
    api<LandingDashboard>(`landing/${pageId}/stats`, { query: { from: range.from, to: range.to, interval } })
      .then((d) => alive && setResult({ key, data: d }))
      .catch((e) => alive && toast(e instanceof Error ? e.message : "Could not load the statistics", "error"));
    return () => {
      alive = false;
    };
  }, [pageId, range.from, range.to, interval, key, toast]);

  const fmtDay = (s: string) => {
    const d = new Date(`${s}T00:00:00Z`);
    const mon = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    return data?.range.interval === "month" ? `${mon} ${String(d.getUTCFullYear()).slice(2)}` : `${mon} ${d.getUTCDate()}`;
  };

  return (
    <div>
      <div className="bbfa-toolbar bbfa-section">
        <div>
          <div className="bbfa-eyebrow">Statistics</div>
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
        <div className="bbfa-loading">Loading statistics...</div>
      ) : (
        <div className={`bbfa-dash${loading ? " is-loading" : ""}`}>
          <Body d={data} fmtDay={fmtDay} />
        </div>
      )}
    </div>
  );
}

function Body({ d, fmtDay }: { d: LandingDashboard; fmtDay: (s: string) => string }) {
  const c = d.cards;
  const a = d.averages;
  const tl = d.timeline;
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minis: [string, string, string][] = [
    ["Views per day", fmtNum(a.viewsPerDay), "average"],
    ["Unique views per day", fmtNum(a.uniquePerDay), "average"],
    ["Clicks per day", fmtNum(a.clicksPerDay), "average"],
    ["Views per visitor", a.viewsPerVisitor === null ? "–" : fmtNum(a.viewsPerVisitor), "views / unique views"],
    ["Sessions per visitor", a.sessionsPerVisitor === null ? "–" : fmtNum(a.sessionsPerVisitor), "return visits"],
    ["Clicks per session", a.clicksPerSession === null ? "–" : fmtNum(a.clicksPerSession), "engagement"],
    ["Visitors who clicked", fmtNum(c.clickers), `${pct(c.uniqueCtr)} of unique views`],
    ["Form submissions", fmtNum(c.submissions), "sent from this page"],
    ["Form conversion", pct(c.conversion), "submissions / unique views"],
    ["All-time views", fmtNum(c.totalViews), "since the page went live"],
  ];

  return (
    <>
      {!c.views ? (
        <div className="bbfa-empty is-inline">
          <div className="bbfa-empty__icon">
            <Icon name="chart" />
          </div>
          <h3>No views in this period</h3>
          <p>Publish the page and share its address, or widen the date range. Visits by signed-in admins are not counted.</p>
        </div>
      ) : null}

      <section className="bbfa-band is-dash">
        <div className="bbfa-kpi">
          <strong>{fmtNum(c.views)}</strong>
          <span>Views</span>
          <small>vs previous {c.days}d {delta(c.views, c.prev.views)}</small>
        </div>
        <div className="bbfa-kpi">
          <strong>{fmtNum(c.unique)}</strong>
          <span>Unique views</span>
          <small>distinct visitors {delta(c.unique, c.prev.unique)}</small>
        </div>
        <div className="bbfa-kpi">
          <strong>{fmtNum(c.sessions)}</strong>
          <span>Sessions</span>
          <small>visits {delta(c.sessions, c.prev.sessions)}</small>
        </div>
        <div className="bbfa-kpi">
          <strong>{fmtNum(c.clicks)}</strong>
          <span>Clicks</span>
          <small>buttons and links {delta(c.clicks, c.prev.clicks)}</small>
        </div>
        <div className="bbfa-kpi">
          <strong>
            {c.ctr === null ? (
              "–"
            ) : (
              <>
                {c.ctr}
                <i>%</i>
              </>
            )}
          </strong>
          <span>Click-through rate</span>
          <small>clicks / views</small>
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
        title="Views over time"
        eyebrow={`Timeline · by ${d.range.interval}`}
        wide
        head={
          <div className="bbfa-legend">
            <span><i style={{ background: RED }} />Views</span>
            <span><i style={{ background: INK }} />Unique views</span>
            <span><i style={{ background: GREY }} />Sessions</span>
          </div>
        }
      >
        <LineChart height={280} labels={tl.labels} labelFmt={fmtDay} series={[{ name: "Sessions", data: tl.sessions, color: GREY, area: false, dash: true }, { name: "Unique views", data: tl.unique, color: INK, area: false }, { name: "Views", data: tl.views, color: RED }]} />
      </Card>

      <div className="bbfa-dash-grid">
        <Card title="Clicks over time" eyebrow={`Timeline · by ${d.range.interval}`}>
          <LineChart labels={tl.labels} labelFmt={fmtDay} series={[{ name: "Clicks", data: tl.clicks, color: RED }]} />
        </Card>
        <Card title="Click-through rate over time" eyebrow="Clicks / views">
          <LineChart labels={tl.labels} labelFmt={fmtDay} fmt={(v) => `${Math.round(v * 10) / 10}%`} series={[{ name: "CTR", data: tl.ctr, color: INK }]} />
        </Card>
        <Card title="Views by weekday" eyebrow="Distribution">
          <BarChart labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]} data={d.weekday} color={RED} unit="views" />
        </Card>
        <Card title="Views by hour of day" eyebrow="Distribution">
          <BarChart labels={hours} tipLabels={hours.map((x) => `${x}:00 – ${x}:59`)} data={d.hours} color={RED} unit="views" />
        </Card>
      </div>

      <div className="bbfa-pies">
        <Card title="Devices" eyebrow="Audience · sessions">
          <DonutChart items={d.devices} caption="sessions" />
        </Card>
        <Card title="Traffic sources" eyebrow="Audience · sessions">
          <DonutChart items={d.channels} caption="sessions" />
        </Card>
        <Card title="New and returning" eyebrow="Audience · visitors">
          <DonutChart items={d.visitors} caption="visitors" />
        </Card>
        <Card title="Countries" eyebrow="Audience · sessions">
          <DonutChart items={d.countries} caption="sessions" />
        </Card>
        <Card title="Browsers" eyebrow="Audience · sessions">
          <DonutChart items={d.browsers} caption="sessions" />
        </Card>
        <Card title="Clicks by button or link" eyebrow="Engagement">
          <DonutChart items={d.clickShare} caption="clicks" />
        </Card>
      </div>

      <Card title="Every button and link" eyebrow="Clicks by element" wide>
        {d.elements.length ? (
          <div className="bbfa-table-wrap">
            <table className="bbfa-table">
              <thead>
                <tr>
                  <th>Button or link</th>
                  <th>Block</th>
                  <th>Goes to</th>
                  <th className="num">Clicks</th>
                  <th className="num">Visitors</th>
                  <th className="num">Share of clicks</th>
                  <th className="num">CTR</th>
                </tr>
              </thead>
              <tbody>
                {d.elements.map((e, i) => (
                  <tr key={i}>
                    <td><strong>{e.label}</strong></td>
                    <td>{e.blockType || "–"}</td>
                    <td className="is-trunc bbfa-url" title={e.href}>{e.href || "–"}</td>
                    <td className="num"><strong>{fmtNum(e.clicks)}</strong></td>
                    <td className="num">{fmtNum(e.clickers)}</td>
                    <td className="num">{e.share}%</td>
                    <td className="num">{pct(e.ctr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="bbfa-muted">No clicks in this period.</p>
        )}
      </Card>

      <Card title="Operating systems" eyebrow="Audience · sessions" wide>
        <DonutChart items={d.systems} caption="sessions" />
      </Card>
    </>
  );
}
