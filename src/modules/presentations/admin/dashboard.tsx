"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { DonutChart } from "@/modules/landing/admin/charts";
import { api, BarChart, fmtNum, Icon, LineChart, RangePicker, useFormatters, useToast, type Range } from "@/modules/forms/admin/ui";
import type { DeckDashboard, LibraryDashboard } from "../lib/stats";
import { StatusPill } from "./tabs";
import "@/modules/landing/admin/landing-admin.css";
import "./presentations-admin.css";

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

function Card({ title, eyebrow, wide, head, children }: { title: string; eyebrow?: string; wide?: boolean; head?: ReactNode; children: ReactNode }) {
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

const mmss = (s: number | null) => (s === null ? "–" : s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

/* -------------------------------------------------------------------------- */
/* One presentation                                                           */
/* -------------------------------------------------------------------------- */

export function DeckDashboardView({ deckId }: { deckId: number }) {
  const toast = useToast();
  const f = useFormatters();
  const [range, setRange] = useState<Range>(() => ({ preset: "30", ...rangeFor30(f.today()) }));
  const [interval, setIntervalState] = useState<"day" | "week" | "month">("day");
  const key = `${range.from}|${range.to}|${interval}`;
  const [result, setResult] = useState<{ key: string; data: DeckDashboard } | null>(null);
  const data = result?.data ?? null;
  const loading = result?.key !== key;

  useEffect(() => {
    let alive = true;
    api<DeckDashboard>(`presentations/${deckId}/stats`, { query: { from: range.from, to: range.to, interval } })
      .then((d) => alive && setResult({ key, data: d }))
      .catch((e) => alive && toast(e instanceof Error ? e.message : "Could not load the statistics", "error"));
    return () => {
      alive = false;
    };
  }, [deckId, range.from, range.to, interval, key, toast]);

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
          <DeckBody d={data} fmtDay={fmtDay} />
        </div>
      )}
    </div>
  );
}

function DeckBody({ d, fmtDay }: { d: DeckDashboard; fmtDay: (s: string) => string }) {
  const c = d.cards;
  const a = d.averages;
  const tl = d.timeline;
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minis: [string, string, string][] = [
    ["Slides in the deck", fmtNum(d.slides), "not counting skipped slides"],
    ["Views per day", fmtNum(a.viewsPerDay), "average"],
    ["Unique viewers per day", fmtNum(a.uniquePerDay), "average"],
    ["Views per viewer", a.viewsPerVisitor === null ? "–" : fmtNum(a.viewsPerVisitor), "views / unique viewers"],
    ["Sessions per viewer", a.sessionsPerVisitor === null ? "–" : fmtNum(a.sessionsPerVisitor), "return visits"],
    ["All-time views", fmtNum(c.totalViews), "since the first opening"],
  ];
  const max = Math.max(1, ...d.funnel);
  return (
    <>
      {!c.views ? (
        <div className="bbfa-empty is-inline">
          <div className="bbfa-empty__icon">
            <Icon name="chart" />
          </div>
          <h3>No views in this period</h3>
          <p>Activate the deck and share its address, or widen the date range. Views by signed-in admins and the Present view are not counted.</p>
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
          <span>Unique viewers</span>
          <small>distinct browsers {delta(c.unique, c.prev.unique)}</small>
        </div>
        <div className="bbfa-kpi">
          <strong>{fmtNum(c.sessions)}</strong>
          <span>Sessions</span>
          <small>visits {delta(c.sessions, c.prev.sessions)}</small>
        </div>
        <div className="bbfa-kpi">
          <strong>{c.avgReach === null ? "–" : <>{c.avgReach}<i>/{d.slides}</i></>}</strong>
          <span>Average reach</span>
          <small>furthest slide, on average</small>
        </div>
        <div className="bbfa-kpi">
          <strong>{c.completion === null ? "–" : <>{c.completion}<i>%</i></>}</strong>
          <span>Reached the end</span>
          <small>views that got to the last slide</small>
        </div>
        <div className="bbfa-kpi">
          <strong>{mmss(c.avgSeconds)}</strong>
          <span>Average time</span>
          <small>with the deck in view</small>
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
            <span><i style={{ background: INK }} />Unique viewers</span>
            <span><i style={{ background: GREY }} />Sessions</span>
          </div>
        }
      >
        <LineChart height={280} labels={tl.labels} labelFmt={fmtDay} series={[{ name: "Sessions", data: tl.sessions, color: GREY, area: false, dash: true }, { name: "Unique viewers", data: tl.unique, color: INK, area: false }, { name: "Views", data: tl.views, color: RED }]} />
      </Card>

      <Card title="Where the audience stops" eyebrow="Slide by slide · views that reached each slide" wide>
        {d.funnel.length && c.views ? (
          <>
            <div className="bbp-funnel" role="img" aria-label={`Views reaching each of ${d.funnel.length} slides`}>
              {d.funnel.map((n, i) => (
                <div key={i} style={{ height: `${Math.max(2, (n / max) * 100)}%` }} data-tip={`Slide ${i + 1}: ${fmtNum(n)} views (${Math.round((n / Math.max(1, c.views)) * 100)}%)`} />
              ))}
            </div>
            <div className="bbp-funnel-x">
              <span>Slide 1</span>
              <span>Slide {d.funnel.length}</span>
            </div>
          </>
        ) : (
          <p className="bbfa-muted">No views in this period.</p>
        )}
      </Card>

      <div className="bbfa-dash-grid">
        <Card title="Views by weekday" eyebrow="Distribution">
          <BarChart labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]} data={d.weekday} color={RED} unit="views" />
        </Card>
        <Card title="Views by hour of day" eyebrow="Distribution">
          <BarChart labels={hours} tipLabels={hours.map((x) => `${x}:00 – ${x}:59`)} data={d.hours} color={RED} unit="views" />
        </Card>
      </div>

      <div className="bbfa-pies">
        <Card title="Slides or accordion" eyebrow="How it was watched · sessions">
          <DonutChart items={d.modes} caption="sessions" />
        </Card>
        <Card title="Devices" eyebrow="Audience · sessions">
          <DonutChart items={d.devices} caption="sessions" />
        </Card>
        <Card title="Traffic sources" eyebrow="Audience · sessions">
          <DonutChart items={d.channels} caption="sessions" />
        </Card>
        <Card title="New and returning" eyebrow="Audience · viewers">
          <DonutChart items={d.visitors} caption="viewers" />
        </Card>
        <Card title="Countries" eyebrow="Audience · sessions">
          <DonutChart items={d.countries} caption="sessions" />
        </Card>
        <Card title="Browsers" eyebrow="Audience · sessions">
          <DonutChart items={d.browsers} caption="sessions" />
        </Card>
      </div>
      <Card title="Operating systems" eyebrow="Audience · sessions" wide>
        <DonutChart items={d.systems} caption="sessions" />
      </Card>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* The whole library                                                          */
/* -------------------------------------------------------------------------- */

export function LibraryDashboardView({ d }: { d: LibraryDashboard }) {
  const f = useFormatters();
  const fmtDay = (s: string) => {
    const x = new Date(`${s}T00:00:00Z`);
    return `${x.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${x.getUTCDate()}`;
  };
  const kpis: [string, ReactNode, string][] = [
    ["Presentations", fmtNum(d.decks), `${fmtNum(d.byStatus.find((s) => s.label === "Active")?.n ?? 0)} active`],
    ["Slides", fmtNum(d.slides), "across all decks"],
    ["Slides per presentation", d.avgSlides === null ? "–" : fmtNum(d.avgSlides), d.medianSlides === null ? "average" : `average · median ${fmtNum(d.medianSlides)}`],
    ["Elements per slide", d.avgElements === null ? "–" : fmtNum(d.avgElements), `${fmtNum(d.elements)} elements in total`],
    ["Views, last 30 days", fmtNum(d.views30), `${fmtNum(d.unique30)} unique viewers`],
    ["Average reach", d.avgReach30 === null ? "–" : fmtNum(d.avgReach30), "furthest slide, last 30 days"],
  ];
  const minis: [string, string, string][] = [
    ["Longest deck", fmtNum(d.maxSlides), "slides"],
    ["Password protected", fmtNum(d.protectedDecks), "presentations"],
    ["Without slides", fmtNum(d.withoutSlides), "empty decks"],
  ];
  return (
    <div className="bbfa-dash">
      <section className="bbfa-band is-dash">
        {kpis.map((k) => (
          <div className="bbfa-kpi" key={k[0]}>
            <strong>{k[1]}</strong>
            <span>{k[0]}</span>
            <small>{k[2]}</small>
          </div>
        ))}
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

      <Card title="Views, last 30 days" eyebrow="All presentations" wide>
        <LineChart height={240} labels={d.timeline.labels} labelFmt={fmtDay} series={[{ name: "Views", data: d.timeline.views, color: RED }]} />
      </Card>

      <div className="bbfa-pies">
        <Card title="By status" eyebrow="Library">
          <DonutChart items={d.byStatus} caption="decks" />
        </Card>
        <Card title="By mode" eyebrow="Library">
          <DonutChart items={d.byMode} caption="decks" />
        </Card>
        <Card title="By layout" eyebrow="Library">
          <DonutChart items={d.byOrientation} caption="decks" />
        </Card>
        <Card title="By category" eyebrow="Library">
          <DonutChart items={d.byCategory} caption="decks" />
        </Card>
        <Card title="Slide layouts in use" eyebrow="Content">
          <DonutChart items={d.kinds} caption="slides" />
        </Card>
        <Card title="Elements in use" eyebrow="Content">
          <DonutChart items={d.elementTypes} caption="elements" />
        </Card>
      </div>

      <div className="bbfa-dash-grid">
        <Card title="Most viewed" eyebrow="Last 30 days">
          {d.top.length ? (
            <div className="bbfa-table-wrap">
              <table className="bbfa-table">
                <thead>
                  <tr>
                    <th>Presentation</th>
                    <th className="num">Views</th>
                    <th className="num">Unique</th>
                    <th className="num">Avg reach</th>
                  </tr>
                </thead>
                <tbody>
                  {d.top.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/admin/presentations/${t.id}/dashboard`}>
                          <strong>{t.title}</strong>
                        </Link>
                      </td>
                      <td className="num">{fmtNum(t.views)}</td>
                      <td className="num">{fmtNum(t.unique)}</td>
                      <td className="num">{t.avgReach ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="bbfa-muted">No views in the last 30 days.</p>
          )}
        </Card>
        <Card title="Recently edited" eyebrow="Library">
          <div className="bbfa-table-wrap">
            <table className="bbfa-table">
              <thead>
                <tr>
                  <th>Presentation</th>
                  <th className="num">Slides</th>
                  <th>Status</th>
                  <th>Edited</th>
                </tr>
              </thead>
              <tbody>
                {d.recent.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/admin/presentations/${t.id}/builder`}>
                        <strong>{t.title}</strong>
                      </Link>
                    </td>
                    <td className="num">{fmtNum(t.slides)}</td>
                    <td>
                      <StatusPill status={t.status} />
                    </td>
                    <td>{f.ago(t.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {d.topTags.length ? (
        <Card title="Tags" eyebrow="Library · decks per tag" wide>
          <DonutChart items={d.topTags} caption="tags" />
        </Card>
      ) : null}
    </div>
  );
}
