import { useState } from "react";
import type { PushupSettings } from "../../shared/types";
import { PushupCard } from "../components/PushupCard";
import { Chain } from "../components/Chain";
import { addDays, fmtDay, fromISO, today } from "../dates";
import { setSoundOn, soundOn } from "../feedback";
import { ACHIEVEMENTS, chainWeeks, DEFAULT_SETTINGS, daysToNextRank, RANKS, type Journey, type PushDay } from "../pushups";
import type { Store } from "../store";

export function PushupsView({ store, journey }: { store: Store; journey: Journey | null }) {
  if (!journey) {
    return (
      <>
        <Head />
        <Setup store={store} />
      </>
    );
  }
  const j = journey;
  return (
    <>
      <Head journey={j} />
      <PushupCard journey={j} store={store} />
      <RankSection j={j} />
      <ChainSection j={j} />
      <NumbersSection j={j} />
      <MarksSection j={j} />
      <RulesSection j={j} store={store} />
    </>
  );
}

function Head({ journey: j }: { journey?: Journey }) {
  return (
    <header className="view-head">
      <h1>Push-ups</h1>
      <div className="view-sub">
        {j ? (
          <>
            Every day since {fmtDay(j.settings.start_date, { month: "short", day: "numeric" })}
            <span className="rank-chip" style={{ ["--c" as string]: j.rank.current.color }}>
              <span className="rank-dot" /> {j.rank.current.name}
            </span>
          </>
        ) : (
          "One rule: every day."
        )}
      </div>
    </header>
  );
}

const BASES = [10, 15, 20, 30, 40];
const PACES: Array<[number, string]> = [
  [1, "every day"],
  [2, "every 2 days"],
  [3, "every 3 days"],
];
const CAPS = [50, 100, 150];

function Setup({ store, initial, onDone }: { store: Store; initial?: PushupSettings; onDone?(): void }) {
  const [s, setS] = useState<PushupSettings>(initial ?? DEFAULT_SETTINGS(today()));
  const [busy, setBusy] = useState(false);
  const days = Math.ceil((s.cap - s.base) * s.step_every) + 1;

  return (
    <section className="setup">
      {!initial && (
        <div className="prose">
          <p>
            Do your push-ups every day. The goal starts where you are and climbs by one rep as you keep showing up. Miss a
            day and the climb waits for you. It never gets harder because you slipped.
          </p>
          <p className="muted">Seven days in a row earns a shield that covers one miss. Lifetime reps rank you from Red to Gold.</p>
        </div>
      )}

      <Choice label="How many can you do today, honestly?">
        {BASES.map((n) => (
          <button type="button" key={n} className={`chip ${s.base === n ? "active" : ""}`} onClick={() => setS({ ...s, base: n, cap: Math.max(s.cap, n) })}>
            {n}
          </button>
        ))}
      </Choice>
      <Choice label="Add one rep">
        {PACES.map(([n, label]) => (
          <button type="button" key={n} className={`chip ${s.step_every === n ? "active" : ""}`} onClick={() => setS({ ...s, step_every: n })}>
            {label}
          </button>
        ))}
      </Choice>
      <Choice label="Up to">
        {CAPS.filter((n) => n >= s.base).map((n) => (
          <button type="button" key={n} className={`chip ${s.cap === n ? "active" : ""}`} onClick={() => setS({ ...s, cap: n })}>
            {n} a day
          </button>
        ))}
      </Choice>
      {initial && (
        <Choice label="Day one">
          <input type="date" className="date-pill" value={s.start_date} max={today()} onChange={(e) => e.target.value && setS({ ...s, start_date: e.target.value })} />
        </Choice>
      )}

      <p className="muted small setup-projection">
        {s.base} → {s.cap} a day in about {days} closed days
        {!initial && <> · around {fmtDay(addDays(today(), days), { month: "long", day: "numeric", year: "numeric" })} if you never miss</>}.
      </p>

      <div className="setup-actions">
        <button
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await store.savePushups(s);
              onDone?.();
            } finally {
              setBusy(false);
            }
          }}
        >
          {initial ? "Save" : "Start day one"}
        </button>
        {onDone && (
          <button type="button" className="btn" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
    </section>
  );
}

function Choice({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="choice">
      <div className="choice-label">{label}</div>
      <div className="chips">{children}</div>
    </div>
  );
}

function RankSection({ j }: { j: Journey }) {
  const eta = daysToNextRank(j);
  return (
    <section className="section">
      <h2 className="section-title">Rank</h2>
      <div className="rank-ladder">
        {RANKS.map((r, i) => (
          <span
            key={r.name}
            className={`rank-pip ${i <= j.rank.index ? "on" : ""} ${i === j.rank.index ? "current" : ""}`}
            style={{ ["--c" as string]: r.color }}
            title={`${r.name} · ${r.at.toLocaleString()}`}
          />
        ))}
      </div>
      {j.rank.next ? (
        <>
          <div className="rank-bar" style={{ ["--c" as string]: j.rank.current.color, ["--n" as string]: j.rank.next.color }}>
            <span style={{ width: `${Math.max(2, j.rank.progress * 100)}%` }} />
          </div>
          <div className="rank-foot">
            <span>
              {j.rank.current.name} · {j.lifetime.toLocaleString()}
            </span>
            <span className="muted">
              {j.rank.toNext.toLocaleString()} to {j.rank.next.name}
              {eta != null && ` · ~${eta} ${eta === 1 ? "day" : "days"} at your pace`}
            </span>
          </div>
        </>
      ) : (
        <p className="muted small">Gold. 36,500 push-ups. Hail, Reaper.</p>
      )}
    </section>
  );
}

function ChainSection({ j }: { j: Journey }) {
  const closed = j.days.filter((d) => d.status === "closed").length;
  const weeks = chainWeeks(j).map((w) => w.map((d) => (d ? { ...d, pct: d.goal ? d.reps / d.goal : 0 } : null)));
  return (
    <section className="section">
      <h2 className="section-title">The chain</h2>
      <Chain
        weeks={weeks}
        today={j.today}
        color={j.rank.current.color}
        describe={chainText}
        summary={`${closed} of ${j.days.length} days closed`}
      />
    </section>
  );
}

function chainText(d: PushDay) {
  if (d.status === "before") return "before day one";
  const sets = d.sets.length ? ` in ${d.sets.length} ${d.sets.length === 1 ? "set" : "sets"}` : "";
  if (d.status === "closed") return `${d.reps} of ${d.goal}${sets}`;
  if (d.status === "shielded") return `${d.reps} of ${d.goal}. A shield held the streak.`;
  if (d.status === "open") return `${d.reps} of ${d.goal} so far`;
  return `${d.reps} of ${d.goal}. Missed.`;
}

function NumbersSection({ j }: { j: Journey }) {
  const rows: Array<[string, string]> = [
    ["Lifetime", j.lifetime.toLocaleString()],
    ["Longest streak", `${j.longest} ${j.longest === 1 ? "day" : "days"}`],
    ["Best day", j.bestDay ? j.bestDay.toLocaleString() : "–"],
    ["Best set", j.bestSet ? `${j.bestSet} unbroken` : "–"],
    ["Days closed", `${j.closedCount} of ${j.days.length}`],
    ["Daily goal", j.nextBumpIn === 0 ? `${j.goal} (summit)` : `${j.goal} → ${j.settings.cap} · +1 in ${j.nextBumpIn} closed ${j.nextBumpIn === 1 ? "day" : "days"}`],
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

function MarksSection({ j }: { j: Journey }) {
  const got = ACHIEVEMENTS.filter((a) => j.unlocked.has(a.id)).length;
  return (
    <section className="section">
      <h2 className="section-title">
        Marks · {got} of {ACHIEVEMENTS.length}
      </h2>
      <ul className="rows marks">
        {ACHIEVEMENTS.map((a) => {
          const on = j.unlocked.has(a.id);
          return (
            <li key={a.id} className={on ? "on" : "off"}>
              <div className="row-line">
                <span className="row-title">
                  <span className="mark-dot" style={on ? { background: j.rank.current.color } : undefined} />
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

function RulesSection({ j, store }: { j: Journey; store: Store }) {
  const [editing, setEditing] = useState(false);
  const [sound, setSound] = useState(soundOn);
  return (
    <section className="section">
      <h2 className="section-title">Rules</h2>
      {editing ? (
        <Setup store={store} initial={j.settings} onDone={() => setEditing(false)} />
      ) : (
        <>
          <ul className="rows">
            <li>
              <div className="row-line">
                <span className="row-title">Start at {j.settings.base}, add 1 every {j.settings.step_every === 1 ? "closed day" : `${j.settings.step_every} closed days`}, up to {j.settings.cap}</span>
                <span className="row-meta">since {fmtDay(j.settings.start_date, { month: "short", day: "numeric", year: fromISO(j.settings.start_date).getFullYear() === fromISO(j.today).getFullYear() ? undefined : "numeric" })}</span>
              </div>
            </li>
            <li>
              <div className="row-line">
                <span className="row-title">7 days in a row earns a shield, up to 2</span>
                <span className="row-meta">covers one miss</span>
              </div>
            </li>
          </ul>
          <div className="rules-actions">
            <button type="button" className="link-btn" onClick={() => setEditing(true)}>
              Change the rules
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setSoundOn(!sound);
                setSound(!sound);
              }}
            >
              Sound {sound ? "on" : "off"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
