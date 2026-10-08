import { useEffect } from "react";
import { RANKS } from "../pushups";
import type { Moment } from "../useJourney";
import { FlameIcon, ShieldIcon } from "./Icons";
import { Ring } from "./Ring";

/** The moment the day closes (or you rank up). Achievements on their own get a quieter toast. */
export function Celebration({ moment, onClose }: { moment: Moment; onClose(): void }) {
  const j = moment.journey;
  const big = moment.closed || !!moment.rankUp;

  useEffect(() => {
    if (big) return;
    const t = setTimeout(onClose, 4200);
    return () => clearTimeout(t);
  }, [moment.key]);

  if (!big) {
    return (
      <div className="mark-toast" role="status" onClick={onClose}>
        {moment.achievements.map((a) => (
          <div key={a.id} className="mark-toast-row">
            <span className="mark-dot" style={{ background: j.rank.current.color }} />
            <span>
              <b>{a.title}</b> <span className="muted">· {a.detail}</span>
            </span>
          </div>
        ))}
      </div>
    );
  }

  const color = j.rank.current.color;
  const justEarnedShield = moment.closed && j.streak > 0 && j.streak % 7 === 0;

  return (
    <div className="sheet-backdrop celebrate-backdrop" onClick={onClose}>
      <div className="window celebrate" style={{ ["--ring" as string]: color }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Day complete">
        <div className="window-bar">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="window-url">sets.jackgisel.com</span>
        </div>
        <div className="celebrate-body">
          <Ring value={j.goal ? j.reps / j.goal : 1} size={132} stroke={12} color={color} className="celebrate-ring">
            <span className="pu-reps">{j.reps}</span>
          </Ring>

          {moment.rankUp ? (
            <>
              <p className="celebrate-kicker">Promoted</p>
              <h2 className="celebrate-title">
                <span className="rank-dot" style={{ background: moment.rankUp.color }} /> {moment.rankUp.name}
              </h2>
              <div className="rank-ladder small">
                {RANKS.map((r, i) => (
                  <span key={r.name} className={`rank-pip ${i <= j.rank.index ? "on" : ""}`} style={{ ["--c" as string]: r.color }} title={r.name} />
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="celebrate-kicker">Day {j.dayNumber}</p>
              <h2 className="celebrate-title">Done.</h2>
            </>
          )}

          <ul className="rows celebrate-rows">
            <li>
              <div className="row-line">
                <span className="row-title">
                  <FlameIcon size={13} className="c-orange" /> Streak
                </span>
                <span className="row-meta">
                  {j.streak} {j.streak === 1 ? "day" : "days"}
                  {j.streak >= j.longest && j.streak > 1 ? " · best ever" : ""}
                </span>
              </div>
            </li>
            {justEarnedShield && (
              <li>
                <div className="row-line">
                  <span className="row-title">
                    <ShieldIcon size={13} className="c-blue" /> Shield earned
                  </span>
                  <span className="row-meta">covers one missed day</span>
                </div>
              </li>
            )}
            {!moment.closed && (
              <li>
                <div className="row-line">
                  <span className="row-title">Today</span>
                  <span className="row-meta">
                    {j.reps} of {j.goal}
                  </span>
                </div>
              </li>
            )}
            {moment.closed && <li>
              <div className="row-line">
                <span className="row-title">Tomorrow</span>
                <span className="row-meta">
                  {j.nextBumpIn === 0 ? `${j.goal} (summit)` : j.nextBumpIn === j.settings.step_every ? `${j.goal + 1} (+1)` : j.goal}
                </span>
              </div>
            </li>}
            {j.rank.next && (
              <li>
                <div className="row-line">
                  <span className="row-title">
                    <span className="rank-dot" style={{ background: j.rank.next.color }} /> {j.rank.next.name}
                  </span>
                  <span className="row-meta">{j.rank.toNext.toLocaleString()} to go</span>
                </div>
              </li>
            )}
            {moment.achievements.map((a) => (
              <li key={a.id}>
                <div className="row-line new-mark">
                  <span className="row-title">{a.title}</span>
                  <span className="row-meta">unlocked</span>
                </div>
              </li>
            ))}
          </ul>

          <blockquote className="celebrate-quote">
            “{moment.quote.text}”<cite>{moment.quote.by}</cite>
          </blockquote>

          <button type="button" className="btn primary wide" onClick={onClose} autoFocus>
            Keep going
          </button>
        </div>
      </div>
    </div>
  );
}
