"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { api, fmtNum, HBars, Icon, LineChart, useToast } from "@/modules/forms/admin/ui";
import type { CourseStats, LibraryStats, Timeline } from "../lib/stats";
import { StatusPill } from "./tabs";
import "@/modules/landing/admin/landing-admin.css";
import "./school-admin.css";

const INK = "#1A1A1A";
const GREY = "#9A9A9A";
const RED = "#C72C2C";

const money = (list: { currency: string; total: number }[]) => (list.length ? list.map((r) => `${r.currency} ${fmtNum(r.total)}`).join(" · ") : "–");

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

function DaysPicker({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  return (
    <div className="bbfa-seg" role="group" aria-label="Period">
      {[7, 30, 90].map((d) => (
        <button key={d} type="button" className={days === d ? "is-active" : ""} onClick={() => onChange(d)}>
          {d} days
        </button>
      ))}
    </div>
  );
}

const fmtDay = (s: string) => {
  const x = new Date(`${s}T00:00:00Z`);
  return `${x.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${x.getUTCDate()}`;
};

function ActivityChart({ tl }: { tl: Timeline }) {
  return (
    <Card
      title="Activity over time"
      eyebrow="Timeline · by day"
      wide
      head={
        <div className="bbfa-legend">
          <span><i style={{ background: RED }} />Lessons completed</span>
          <span><i style={{ background: INK }} />Active learners</span>
          <span><i style={{ background: GREY }} />New enrolments</span>
        </div>
      }
    >
      <LineChart height={280} labels={tl.labels} labelFmt={fmtDay} series={[{ name: "New enrolments", data: tl.enrolments, color: GREY, area: false, dash: true }, { name: "Active learners", data: tl.learners, color: INK, area: false }, { name: "Lessons completed", data: tl.completions, color: RED }]} />
    </Card>
  );
}

function Kpi({ value, label, sub }: { value: ReactNode; label: string; sub?: string }) {
  return (
    <div className="bbfa-kpi">
      <strong>{value}</strong>
      <span>{label}</span>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

function useStats<T>(path: string, days: number) {
  const toast = useToast();
  const [result, setResult] = useState<{ days: number; data: T } | null>(null);
  useEffect(() => {
    let alive = true;
    api<T>(path, { query: { days } })
      .then((d) => alive && setResult({ days, data: d }))
      .catch((e) => alive && toast(e instanceof Error ? e.message : "Could not load the statistics", "error"));
    return () => {
      alive = false;
    };
  }, [path, days, toast]);
  return { data: result?.data ?? null, loading: result?.days !== days };
}

/* -------------------------------------------------------------------------- */
/* The whole School                                                        */
/* -------------------------------------------------------------------------- */

export function LibraryDashboardView() {
  const [days, setDays] = useState(30);
  const { data, loading } = useStats<LibraryStats>("school/stats", days);
  return (
    <div>
      <div className="bbfa-toolbar bbfa-section">
        <div>
          <div className="bbfa-eyebrow">Statistics</div>
          <h2 className="bbfa-h2">Dashboard</h2>
        </div>
        <span className="bbfa-spacer" />
        <DaysPicker days={days} onChange={setDays} />
      </div>
      {!data ? (
        <div className="bbfa-loading">Loading statistics...</div>
      ) : (
        <div className={`bbfa-dash${loading ? " is-loading" : ""}`}>
          <section className="bbfa-band is-dash">
            <Kpi value={fmtNum(data.cards.students)} label="Students" sub="with an active course" />
            <Kpi value={fmtNum(data.cards.activeLearners)} label="Active learners" sub={`opened a lesson, last ${days} days`} />
            <Kpi value={fmtNum(data.cards.completions)} label="Lessons completed" sub={`last ${days} days`} />
            <Kpi value={fmtNum(data.cards.newEnrolments)} label="New enrolments" sub={`last ${days} days`} />
            <Kpi value={fmtNum(data.cards.pending)} label="Awaiting payment" sub={data.cards.pending ? "confirm under Students" : "nothing to confirm"} />
            <Kpi value={fmtNum(data.cards.openQuestions)} label="Unanswered questions" sub={data.cards.openQuestions ? "see Discussion" : "all answered"} />
          </section>
          <div className="bbfa-minis">
            <div className="bbfa-mini-card">
              <span>Courses</span>
              <strong>{fmtNum(data.cards.courses)}</strong>
              <small>{fmtNum(data.cards.activeCourses)} active</small>
            </div>
            <div className="bbfa-mini-card">
              <span>Published lessons</span>
              <strong>{fmtNum(data.cards.lessons)}</strong>
              <small>in active courses</small>
            </div>
            <div className="bbfa-mini-card">
              <span>Confirmed payments</span>
              <strong>{money(data.revenue)}</strong>
              <small>all time{data.revenue.some((r) => r.period) ? `, ${money(data.revenue.map((r) => ({ currency: r.currency, total: r.period })))} in ${days} days` : ""}</small>
            </div>
          </div>
          <ActivityChart tl={data.timeline} />
          <Card title="Courses" eyebrow="Students, progress and payments" wide>
            {data.courses.length ? (
              <div className="bbfa-table-wrap">
                <table className="bbfa-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th className="num">Students</th>
                      <th className="num">Active</th>
                      <th className="num">Average progress</th>
                      <th className="num">Finished</th>
                      <th>Confirmed payments</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.courses.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/admin/school/${c.id}/dashboard`}>{c.title}</Link> <StatusPill status={c.status} />
                          <div className="bbfa-sub">{c.lessons} published lessons</div>
                        </td>
                        <td className="num">
                          {fmtNum(c.students)}
                          {c.pending ? <div className="bbfa-sub">{c.pending} awaiting payment</div> : null}
                        </td>
                        <td className="num">{fmtNum(c.active)}</td>
                        <td className="num">{c.avgProgress === null ? "–" : `${c.avgProgress}%`}</td>
                        <td className="num">{fmtNum(c.finished)}</td>
                        <td>{money(c.revenue)}</td>
                        <td className="bbfa-row-actions">
                          <Link href={`/admin/school/${c.id}/dashboard`}>Analytics</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="bbfa-muted">No courses yet.</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* One course                                                                 */
/* -------------------------------------------------------------------------- */

export function CourseDashboardView({ courseId }: { courseId: number }) {
  const [days, setDays] = useState(30);
  const { data, loading } = useStats<CourseStats>(`school/courses/${courseId}/stats`, days);
  return (
    <div>
      <div className="bbfa-toolbar bbfa-section">
        <div>
          <div className="bbfa-eyebrow">Analytics</div>
          <h2 className="bbfa-h2">How students move through the course</h2>
        </div>
        <span className="bbfa-spacer" />
        <DaysPicker days={days} onChange={setDays} />
      </div>
      {!data ? (
        <div className="bbfa-loading">Loading statistics...</div>
      ) : (
        <div className={`bbfa-dash${loading ? " is-loading" : ""}`}>
          <CourseBody d={data} />
        </div>
      )}
    </div>
  );
}

function CourseBody({ d }: { d: CourseStats }) {
  const c = d.cards;
  const started = Math.max(1, ...d.funnel.map((l) => l.started));
  // The lesson where the biggest share of students who opened it did not finish it.
  const worst = d.funnel.filter((l) => l.started >= 3).map((l) => ({ l, drop: 1 - l.completed / l.started })).sort((a, b) => b.drop - a.drop)[0];
  return (
    <>
      {!c.students && !c.pending ? (
        <div className="bbfa-empty is-inline">
          <div className="bbfa-empty__icon">
            <Icon name="chart" />
          </div>
          <h3>No students yet</h3>
          <p>Statistics appear when students enrol and open lessons. Staff views are never counted.</p>
        </div>
      ) : null}
      <section className="bbfa-band is-dash">
        <Kpi value={fmtNum(c.students)} label="Students" sub={c.pending ? `${c.pending} awaiting payment` : "active enrolments"} />
        <Kpi value={fmtNum(c.activeLearners)} label="Active learners" sub={`last ${d.days} days`} />
        <Kpi value={c.avgProgress === null ? "–" : <>{c.avgProgress}<i>%</i></>} label="Average progress" sub="of the published lessons" />
        <Kpi value={fmtNum(c.finished)} label="Finished the course" sub={c.completionRate === null ? "" : `${c.completionRate}% of students`} />
        <Kpi value={fmtNum(c.newEnrolments)} label="New enrolments" sub={`last ${d.days} days`} />
        <Kpi value={fmtNum(c.openQuestions)} label="Unanswered questions" sub={`${fmtNum(c.comments)} comments in total`} />
      </section>
      <div className="bbfa-minis">
        <div className="bbfa-mini-card">
          <span>Confirmed payments</span>
          <strong>{money(d.revenue)}</strong>
          <small>all time</small>
        </div>
        <div className="bbfa-mini-card">
          <span>Removed students</span>
          <strong>{fmtNum(c.revoked)}</strong>
          <small>access removed</small>
        </div>
        <div className="bbfa-mini-card">
          <span>Question box answers</span>
          <strong>{fmtNum(c.sharedAnswers)}</strong>
          <small>written by students</small>
        </div>
        {worst && worst.drop > 0 ? (
          <div className="bbfa-mini-card">
            <span>Biggest drop-off</span>
            <strong>{Math.round(worst.drop * 100)}%</strong>
            <small>of those who opened it did not finish: {worst.l.title}</small>
          </div>
        ) : null}
      </div>

      <ActivityChart tl={d.timeline} />

      <Card title="Lesson by lesson" eyebrow="Opened and completed · students only" wide>
        {d.funnel.length ? (
          <div className="bbfa-table-wrap">
            <table className="bbfa-table">
              <thead>
                <tr>
                  <th>Lesson</th>
                  <th className="num">Opened</th>
                  <th className="num">Completed</th>
                  <th>Completion</th>
                  <th className="num">Comments</th>
                </tr>
              </thead>
              <tbody>
                {d.funnel.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {l.title}
                      <div className="bbfa-sub">{l.module}</div>
                    </td>
                    <td className="num">{fmtNum(l.started)}</td>
                    <td className="num">{fmtNum(l.completed)}</td>
                    <td style={{ minWidth: 160 }}>
                      <div className="bbfa-hbar__track">
                        <div className="bbfa-hbar__fill" style={{ width: `${(l.started / started) * 100}%`, background: GREY }} />
                      </div>
                      <div className="bbfa-hbar__track" style={{ marginTop: 3 }}>
                        <div className="bbfa-hbar__fill" style={{ width: `${(l.completed / started) * 100}%` }} />
                      </div>
                      <div className="bbfa-sub">{l.started ? `${Math.round((l.completed / l.started) * 100)}% of those who opened it` : "not opened yet"}</div>
                    </td>
                    <td className="num">{fmtNum(l.comments)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="bbfa-muted">No published lessons yet.</p>
        )}
      </Card>

      {d.polls.length ? (
        <div className="bbfa-dash-grid">
          {d.polls.map((p) => {
            const total = p.counts.reduce((a, b) => a + b, 0);
            return (
              <Card key={p.blockId} title={p.question || "Poll"} eyebrow={`Poll · ${p.lesson} · ${total} ${total === 1 ? "vote" : "votes"}`}>
                <HBars items={p.options.map((o, i) => ({ label: o, n: p.counts[i] ?? 0, pct: total ? Math.round(((p.counts[i] ?? 0) / total) * 100) : 0 }))} />
              </Card>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
