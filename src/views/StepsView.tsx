import { useState } from "react";
import { BarChart } from "../components/Charts";
import { Chain } from "../components/Chain";
import { StepsCard } from "../components/StepsCard";
import { addDays, fmtDay, fromISO, today } from "../dates";
import { weekRows } from "../pushups";
import {
  daysToNextWaypoint,
  fmtMiles,
  fmtSteps,
  milesFor,
  STEP_ACHIEVEMENTS,
  STEP_GOAL,
  WAYPOINTS,
  type Walk,
  type WalkDay,
} from "../steps";
import type { Store } from "../store";

export function StepsView({ store, walk: w }: { store: Store; walk: Walk }) {
  return (
    <>
      <header className="view-head">
        <h1>Steps</h1>
        <div className="view-sub">
          Ten thousand a day{w.lifetime > 0 && <> · since {fmtDay(w.start, { month: "short", day: "numeric" })}</>}
        </div>
      </header>
      <StepsCard walk={w} store={store} />
      <RoadSection w={w} />
      <RecentSection w={w} />
      <ChainSection w={w} />
      <NumbersSection w={w} />
      <MarksSection w={w} />
      <PastDaySection store={store} />
      <SyncSection />
    </>
  );
}

function RoadSection({ w }: { w: Walk }) {
  const eta = daysToNextWaypoint(w);
  const { index, next, progress, toNext } = w.waypoint;
  return (
    <section className="section">
      <h2 className="section-title">The road · {fmtMiles(w.miles)} mi</h2>
      <ol className="road">
        {WAYPOINTS.map((p, i) => {
          const state = i <= index ? "past" : i === index + 1 ? "next" : "ahead";
          return (
            <li key={p.name} className={`stop ${state}`}>
              <span className="stop-dot" />
              <div className="stop-body">
                <div className="row-line">
                  <span className="row-title">{p.name}</span>
                  <span className="row-meta">{p.miles.toLocaleString()} mi</span>
                </div>
                {state === "next" && next && (
                  <>
                    <div className="rank-bar" style={{ ["--c" as string]: "var(--walk)", ["--n" as string]: "var(--walk)" }}>
                      <span style={{ width: `${Math.max(2, progress * 100)}%` }} />
                    </div>
                    <p className="stop-note muted small">
                      {fmtMiles(toNext)} mi to go
                      {eta != null && ` · ~${eta} ${eta === 1 ? "day" : "days"} at your pace`}
                    </p>
                  </>
                )}
                {i === index && <p className="stop-note muted small">{p.note}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function RecentSection({ w }: { w: Walk }) {
  const byDate = new Map(w.days.map((d) => [d.date, d.steps]));
  const data = Array.from({ length: 28 }, (_, i) => {
    const date = addDays(w.today, i - 27);
    return {
      label: fmtDay(date, { month: "numeric", day: "numeric" }),
      value: byDate.get(date) ?? 0,
      tip: fmtDay(date),
    };
  });
  return (
    <section className="section">
      <h2 className="section-title">Last 4 weeks</h2>
      <BarChart data={data} goal={STEP_GOAL} color="var(--walk)" format={(n) => `${fmtSteps(n)} steps`} labelEvery={7} />
    </section>
  );
}

function dayText(d: WalkDay) {
  if (d.status === "before") return "before your first walk";
  const n = `${fmtSteps(d.steps)} steps`;
  if (d.status === "closed") return d.tier >= 3 ? `${n}. Double.` : d.tier === 2 ? `${n}. Fifteen.` : n;
  if (d.status === "shielded") return `${n}. A shield held the streak.`;
  if (d.status === "open") return `${n} so far`;
  return `${n}. Missed.`;
}

function ChainSection({ w }: { w: Walk }) {
  const weeks = weekRows(w.days, w.today, (date): WalkDay => ({ date, steps: 0, status: "before", tier: 0 })).map((row) =>
    row.map((d) => (d ? { ...d, pct: d.steps / STEP_GOAL, bonus: d.tier > 1 ? d.tier : undefined } : null)),
  );
  return (
    <section className="section">
      <h2 className="section-title">The chain</h2>
      <Chain weeks={weeks} today={w.today} color="var(--walk)" describe={dayText} summary={`${w.closedCount} of ${w.days.length} days at 10k`} />
    </section>
  );
}

function NumbersSection({ w }: { w: Walk }) {
  const rows: Array<[string, string]> = [
    ["Lifetime", `${fmtSteps(w.lifetime)} · ${fmtMiles(w.miles)} mi`],
    ["This week", `${fmtSteps(w.weekSteps)} of 70,000`],
    ["14-day average", fmtSteps(w.pace)],
    ["Longest streak", `${w.longest} ${w.longest === 1 ? "day" : "days"}`],
    ["Best day", w.bestDay ? `${fmtSteps(w.bestDay)} · ${fmtMiles(milesFor(w.bestDay))} mi` : "–"],
    ["Best week", w.bestWeek ? fmtSteps(w.bestWeek) : "–"],
  ];
  return (
    <section className="section">
      <h2 className="section-title">Numbers</h2>
      <ul className="rows">
        {rows.map(([k, v]) => (
          <li key={k}>
            <div className="row-line">
              <span className="row-title">{k}</span>
              <span className="row-meta">{v}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MarksSection({ w }: { w: Walk }) {
  const got = STEP_ACHIEVEMENTS.filter((a) => w.unlocked.has(a.id)).length;
  return (
    <section className="section">
      <h2 className="section-title">
        Marks · {got} of {STEP_ACHIEVEMENTS.length}
      </h2>
      <ul className="rows marks">
        {STEP_ACHIEVEMENTS.map((a) => {
          const on = w.unlocked.has(a.id);
          return (
            <li key={a.id} className={on ? "on" : "off"}>
              <div className="row-line">
                <span className="row-title">
                  <span className="mark-dot" style={on ? { background: "var(--walk)" } : undefined} />
                  {on ? a.title : "???"}
                </span>
                <span className="row-meta">{a.detail}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PastDaySection({ store }: { store: Store }) {
  const t = today();
  const [date, setDate] = useState(addDays(t, -1));
  const [n, setN] = useState("");
  const current = store.steps.find((d) => d.date === date)?.steps;
  return (
    <section className="section">
      <h2 className="section-title">Fix a day</h2>
      <form
        className="walk-form"
        onSubmit={(e) => {
          e.preventDefault();
          const v = Number(n.replace(/[^\d]/g, ""));
          if (n.trim() && Number.isFinite(v)) store.saveSteps(date, v).then(() => setN(""));
        }}
      >
        <input type="date" className="date-pill" value={date} max={t} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <input inputMode="numeric" placeholder={current != null ? fmtSteps(current) : "Steps"} value={n} onChange={(e) => setN(e.target.value)} aria-label="Steps that day" />
        <button type="submit" className="btn small" disabled={!n.trim()}>
          Save
        </button>
      </form>
      <p className="muted small">
        {fromISO(date).toLocaleDateString(undefined, { weekday: "long" })}: {current != null ? `${fmtSteps(current)} steps logged` : "nothing logged"}. Saving replaces the day's total; 0 clears it.
      </p>
    </section>
  );
}

function SyncSection() {
  const origin = window.location.origin;
  return (
    <section className="section">
      <h2 className="section-title">Sync from iPhone</h2>
      <div className="prose small">
        <p>
          Make a Shortcut that runs every evening (Automation → Time of Day, say 9pm, and again at 11:55pm so late walks count):
        </p>
        <ol className="steps-list">
          <li>
            <b>Find Health Samples</b> where Type is Steps and Start Date is today. Group by day, fill missing with 0.
          </li>
          <li>
            <b>Calculate Statistics</b>: Sum of the samples.
          </li>
          <li>
            <b>Get Contents of URL</b>: <code>{origin}/api/steps</code>, method POST, header <code>Authorization: Bearer &lt;AGENT_TOKEN&gt;</code>,
            JSON body <code>steps</code> = the sum and <code>date</code> = Current Date formatted <code>yyyy-MM-dd</code>.
          </li>
        </ol>
        <p className="muted">
          Each sync replaces today's total, so running it more than once is fine. Agents can also call <code>log_steps</code> over MCP.
        </p>
      </div>
    </section>
  );
}
