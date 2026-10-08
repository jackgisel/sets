import { useEffect, type ReactNode } from "react";
import { RANKS, type Achievement, type QUOTES } from "../pushups";
import { fmtMiles, fmtSteps, milesFor, STEP_GOAL, WAYPOINTS } from "../steps";
import type { Moment } from "../useJourney";
import type { WalkMoment } from "../useWalk";
import { FlameIcon, ShieldIcon } from "./Icons";
import { Ring } from "./Ring";

interface Row {
  label: ReactNode;
  value: ReactNode;
  fresh?: boolean;
}

/** The card both challenges use when a day closes or a milestone lands. */
function CelebrationCard({
  color,
  ring,
  kicker,
  title,
  extra,
  rows,
  quote,
  label,
  onClose,
}: {
  color: string;
  ring: { value: number; center: ReactNode };
  kicker: string;
  title: ReactNode;
  extra?: ReactNode;
  rows: Row[];
  quote: (typeof QUOTES)[number];
  label: string;
  onClose(): void;
}) {
  return (
    <div className="sheet-backdrop celebrate-backdrop" onClick={onClose}>
      <div className="celebrate" style={{ ["--ring" as string]: color }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={label}>
        <Ring value={ring.value} size={132} stroke={12} color={color} className="celebrate-ring">
          {ring.center}
        </Ring>
        <p className="celebrate-kicker">{kicker}</p>
        <h2 className="celebrate-title">{title}</h2>
        {extra}
        <ul className="rows celebrate-rows">
          {rows.map((r, i) => (
            <li key={i}>
              <div className={`row-line ${r.fresh ? "new-mark" : ""}`}>
                <span className="row-title">{r.label}</span>
                <span className="row-meta">{r.value}</span>
              </div>
            </li>
          ))}
        </ul>
        <blockquote className="celebrate-quote">
          “{quote.text}”<cite>{quote.by}</cite>
        </blockquote>
        <button type="button" className="btn primary wide" onClick={onClose} autoFocus>
          Keep going
        </button>
      </div>
    </div>
  );
}

/** Achievements on their own get a quieter toast. */
function MarkToast({ marks, color, onClose }: { marks: Achievement[]; color: string; onClose(): void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4200);
    return () => clearTimeout(t);
  }, [marks]);
  return (
    <div className="mark-toast" role="status" onClick={onClose}>
      {marks.map((a) => (
        <div key={a.id} className="mark-toast-row">
          <span className="mark-dot" style={{ background: color }} />
          <span>
            <b>{a.title}</b> <span className="muted">· {a.detail}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

const streakRow = (streak: number, longest: number): Row => ({
  label: (
    <>
      <FlameIcon size={13} className="c-orange" /> Streak
    </>
  ),
  value: `${streak} ${streak === 1 ? "day" : "days"}${streak >= longest && streak > 1 ? " · best ever" : ""}`,
});

const shieldRow: Row = {
  label: (
    <>
      <ShieldIcon size={13} className="c-blue" /> Shield earned
    </>
  ),
  value: "covers one missed day",
};

const markRows = (marks: Achievement[]): Row[] => marks.map((a) => ({ label: a.title, value: "unlocked", fresh: true }));

/** The moment the push-up day closes (or you rank up). */
export function Celebration({ moment, onClose }: { moment: Moment; onClose(): void }) {
  const j = moment.journey;
  const color = j.rank.current.color;
  if (!moment.closed && !moment.rankUp) return <MarkToast marks={moment.achievements} color={color} onClose={onClose} />;

  const rows: Row[] = [streakRow(j.streak, j.longest)];
  if (moment.closed && j.streak > 0 && j.streak % 7 === 0) rows.push(shieldRow);
  if (!moment.closed) rows.push({ label: "Today", value: `${j.reps} of ${j.goal}` });
  if (moment.closed) {
    rows.push({
      label: "Tomorrow",
      value: j.nextBumpIn === 0 ? `${j.goal} (summit)` : j.nextBumpIn === j.settings.step_every ? `${j.goal + 1} (+1)` : j.goal,
    });
  }
  if (j.rank.next) {
    rows.push({
      label: (
        <>
          <span className="rank-dot" style={{ background: j.rank.next.color }} /> {j.rank.next.name}
        </>
      ),
      value: `${j.rank.toNext.toLocaleString()} to go`,
    });
  }
  rows.push(...markRows(moment.achievements));

  return (
    <CelebrationCard
      color={color}
      label="Push-ups done"
      ring={{ value: j.goal ? j.reps / j.goal : 1, center: <span className="pu-reps">{j.reps}</span> }}
      kicker={moment.rankUp ? "Promoted" : `Push-ups · day ${j.dayNumber}`}
      title={
        moment.rankUp ? (
          <>
            <span className="rank-dot" style={{ background: moment.rankUp.color }} /> {moment.rankUp.name}
          </>
        ) : (
          "Done."
        )
      }
      extra={
        moment.rankUp && (
          <div className="rank-ladder small">
            {RANKS.map((r, i) => (
              <span key={r.name} className={`rank-pip ${i <= j.rank.index ? "on" : ""}`} style={{ ["--c" as string]: r.color }} title={r.name} />
            ))}
          </div>
        )
      }
      rows={rows}
      quote={moment.quote}
      onClose={onClose}
    />
  );
}

/** The moment you hit 10,000 (or reach a new waypoint on the road). */
export function WalkCelebration({ moment, onClose }: { moment: WalkMoment; onClose(): void }) {
  const w = moment.walk;
  const color = "var(--walk)";
  if (!moment.closed && !moment.waypoint && moment.tier === 0) {
    return <MarkToast marks={moment.achievements} color={color} onClose={onClose} />;
  }

  const rows: Row[] = [streakRow(w.streak, w.longest)];
  if (moment.closed && w.streak > 0 && w.streak % 7 === 0) rows.push(shieldRow);
  rows.push({ label: "Today", value: `${fmtSteps(w.steps)} · ${fmtMiles(milesFor(w.steps))} mi` });
  if (w.waypoint.next) rows.push({ label: w.waypoint.next.name, value: `${fmtMiles(w.waypoint.toNext)} mi to go` });
  rows.push(...markRows(moment.achievements));

  const wp = moment.waypoint;
  return (
    <CelebrationCard
      color={color}
      label="Steps done"
      ring={{ value: w.steps / STEP_GOAL, center: <span className="pu-reps">{w.steps >= 10_000 ? `${Math.floor(w.steps / 1000)}k` : fmtSteps(w.steps)}</span> }}
      kicker={wp ? `Mile ${fmtMiles(wp.miles)}` : `Steps · day ${w.dayNumber}`}
      title={wp ? wp.name : moment.tier >= 3 ? "Double." : moment.tier === 2 ? "Fifteen." : "Ten thousand."}
      extra={
        wp && (
          <>
            <p className="celebrate-note">{wp.note}</p>
            <div className="rank-ladder small">
              {WAYPOINTS.slice(1).map((p, i) => (
                <span key={p.name} className={`rank-pip ${i < w.waypoint.index ? "on" : ""}`} style={{ ["--c" as string]: color }} title={p.name} />
              ))}
            </div>
          </>
        )
      }
      rows={rows}
      quote={moment.quote}
      onClose={onClose}
    />
  );
}
