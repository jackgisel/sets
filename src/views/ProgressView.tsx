import { useMemo, useState } from "react";
import { BarChart, LineChart } from "../components/Charts";
import { Heatmap } from "../components/Heatmap";
import { fmtDay, fromISO, today } from "../dates";
import { compact } from "../format";
import type { Store } from "../store";
import { dayStats, doneEntries, exerciseSeries, streaks, weekly, type Metric } from "../stats";

const METRIC_FMT: Record<Metric, (n: number) => string> = {
  weight: (n) => `${compact(n)} lb`,
  volume: (n) => `${compact(n)} lb`,
  reps: (n) => `${compact(n)} reps`,
  distance: (n) => `${n} mi`,
  minutes: (n) => `${Math.round(n)} min`,
};

const METRIC_LABEL: Record<Metric, string> = {
  weight: "Top set weight",
  volume: "Volume",
  reps: "Total reps",
  distance: "Distance",
  minutes: "Minutes",
};

export function ProgressView({ store }: { store: Store }) {
  const done = useMemo(() => doneEntries(store.entries), [store.entries]);
  const days = useMemo(() => dayStats(done), [done]);
  const { current, longest } = streaks(days);
  const weeks = useMemo(() => weekly(done, 16), [done]);
  const t = today();
  const yearStart = `${t.slice(0, 4)}-01-01`;
  const monthStart = `${t.slice(0, 7)}-01`;
  const daysThisYear = [...days.keys()].filter((d) => d >= yearStart).length;
  const daysThisMonth = [...days.keys()].filter((d) => d >= monthStart).length;

  const top = store.exercises.slice(0, 10).map((e) => e.exercise);
  const [picked, setPicked] = useState<string | null>(null);
  const exercise = picked ?? top[0] ?? null;
  const series = useMemo(() => (exercise ? exerciseSeries(done, exercise) : null), [done, exercise]);

  const weekLabel = (s: string) => fmtDay(s, { month: "short", day: "numeric" });
  const hasVolume = weeks.some((w) => w.volume > 0);

  return (
    <>
      <header className="view-head">
        <h1>
          <span className="h-icon blue">
            <svg width="24" height="24" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="4.5" fill="currentColor" />
              <rect x="6.5" y="12.5" width="2.6" height="5" rx="1" fill="#fff" />
              <rect x="10.7" y="9" width="2.6" height="8.5" rx="1" fill="#fff" />
              <rect x="14.9" y="6.5" width="2.6" height="11" rx="1" fill="#fff" />
            </svg>
          </span>
          Progress
        </h1>
        <div className="view-sub">{fromISO(t).getFullYear()} so far</div>
      </header>

      <div className="stats">
        <Stat value={current} label="Current streak" unit={current === 1 ? "day" : "days"} accent="orange" />
        <Stat value={longest} label="Longest streak" unit={longest === 1 ? "day" : "days"} />
        <Stat value={daysThisMonth} label="This month" unit="days" />
        <Stat value={daysThisYear} label="This year" unit="days" />
      </div>

      <section className="panel">
        <h2 className="panel-title">
          {days.size} workout {days.size === 1 ? "day" : "days"} in the last year
        </h2>
        <Heatmap days={days} />
      </section>

      <section className="panel">
        <h2 className="panel-title">Workouts per week</h2>
        <BarChart
          data={weeks.map((w) => ({ label: weekLabel(w.start), value: w.days, tip: `week of ${weekLabel(w.start)}` }))}
          format={(n) => `${n} ${n === 1 ? "day" : "days"}`}
          labelEvery={4}
          color="var(--green)"
        />
      </section>

      {hasVolume && (
        <section className="panel">
          <h2 className="panel-title">Weekly volume lifted</h2>
          <BarChart
            data={weeks.map((w) => ({ label: weekLabel(w.start), value: Math.round(w.volume), tip: `week of ${weekLabel(w.start)}` }))}
            format={(n) => `${compact(n)} lb`}
            labelEvery={4}
          />
        </section>
      )}

      <section className="panel">
        <h2 className="panel-title">Exercise progress</h2>
        {top.length === 0 ? (
          <p className="muted">Log a few workouts to see trends per exercise.</p>
        ) : (
          <>
            <div className="chips">
              {top.map((name) => (
                <button type="button" key={name} className={`chip ${name === exercise ? "active" : ""}`} onClick={() => setPicked(name)}>
                  {name}
                </button>
              ))}
            </div>
            {series && (
              <>
                <div className="muted small">
                  {METRIC_LABEL[series.metric]} · {series.sessions} {series.sessions === 1 ? "session" : "sessions"}
                </div>
                <LineChart data={series.points} format={METRIC_FMT[series.metric]} color="var(--purple)" />
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}

function Stat({ value, label, unit, accent }: { value: number; label: string; unit: string; accent?: string }) {
  return (
    <div className={`stat ${accent ?? ""}`}>
      <div className="stat-value">
        {value}
        <span className="stat-unit"> {unit}</span>
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
