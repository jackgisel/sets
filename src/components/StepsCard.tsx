import { useState } from "react";
import { plink } from "../feedback";
import { fmtMiles, fmtSteps, milesFor, STEP_GOAL, type Walk } from "../steps";
import type { Store } from "../store";
import { FlameIcon, ShieldIcon } from "./Icons";
import { Ring } from "./Ring";

const TOP_UPS = [1_000, 2_500, 5_000];

function hoursLeft() {
  const now = new Date();
  return 24 - now.getHours() - (now.getMinutes() > 0 ? 1 : 0);
}

export function walkStatus(w: Walk): { text: string; tone: "ok" | "risk" | "muted" } {
  if (w.steps >= 20_000) return { text: "Double. Your feet have earned the evening.", tone: "ok" };
  if (w.steps >= 15_000) return { text: `Fifteen. ${fmtSteps(20_000 - w.steps)} more for double.`, tone: "ok" };
  if (w.closedToday) return { text: `Closed. ${fmtSteps(15_000 - w.steps)} more for fifteen.`, tone: "ok" };
  const miles = fmtMiles(milesFor(w.remaining));
  const left = hoursLeft();
  if (w.streak > 0 && left <= 5) {
    return {
      text: w.shields > 0 ? `${left}h left. A shield will cover a miss, but don't spend it.` : `${left}h left to keep a ${w.streak}-day streak. About ${miles} miles.`,
      tone: "risk",
    };
  }
  if (w.steps === 0) return { text: "Ten thousand. Out the door.", tone: "muted" };
  return { text: `${fmtSteps(w.remaining)} to go, about ${miles} ${miles === "1.0" ? "mile" : "miles"}.`, tone: "muted" };
}

function syncedLabel(store: Store, date: string): string | null {
  const day = store.steps.find((d) => d.date === date);
  if (!day || day.source === "manual" || day.source === "me") return null;
  const at = new Date(day.updated_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `Synced ${at}`;
}

export function StepsCard({ walk: w, store, onOpen }: { walk: Walk; store: Store; onOpen?(): void }) {
  const [total, setTotal] = useState("");
  const [busy, setBusy] = useState(false);
  const status = walkStatus(w);
  const synced = syncedLabel(store, w.today);

  const save = async (n: number, mode: "set" | "add") => {
    if (busy || n < 0) return;
    setBusy(true);
    plink();
    try {
      await store.saveSteps(w.today, Math.round(n), mode);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`pu-card walk-card ${w.closedToday ? "closed" : ""}`} style={{ ["--ring" as string]: "var(--walk)" }}>
      <div className="pu-main">
        <button type="button" className="pu-ring-btn" onClick={onOpen} disabled={!onOpen} aria-label="Open steps">
          <Ring value={w.steps / STEP_GOAL} size={124} stroke={11} color="var(--walk)">
            <span className="pu-reps">{w.steps >= 10_000 ? `${(w.steps / 1000).toFixed(1).replace(/\.0$/, "")}k` : fmtSteps(w.steps)}</span>
            <span className="pu-goal">of 10k</span>
          </Ring>
        </button>
        <div className="pu-body">
          <div className="pu-title">
            <button type="button" className="pu-day" onClick={onOpen} disabled={!onOpen}>
              Steps
            </button>
            <span className="pu-badges">
              <span className={`pu-badge ${w.streak ? "lit" : ""}`} title="Streak">
                <FlameIcon size={13} /> {w.streak}
              </span>
              {Array.from({ length: w.shields }, (_, i) => (
                <span key={i} className="pu-badge shield" title="Shield: covers one missed day">
                  <ShieldIcon size={13} />
                </span>
              ))}
            </span>
          </div>
          <p className={`pu-status ${status.tone}`}>{status.text}</p>
          <TierTrack steps={w.steps} />
          <form
            className="walk-form"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(total.replace(/[^\d]/g, ""));
              if (total.trim() !== "" && Number.isFinite(n)) save(n, "set").then(() => setTotal(""));
            }}
          >
            <input
              inputMode="numeric"
              placeholder={w.steps ? fmtSteps(w.steps) : "Today's total"}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              aria-label="Today's step total"
            />
            <button type="submit" className="btn small" disabled={busy || !total.trim()}>
              Set
            </button>
            {TOP_UPS.map((n) => (
              <button type="button" key={n} className="pu-chip" disabled={busy} onClick={() => save(n, "add")} title={`Add ${fmtSteps(n)} steps`}>
                +{n / 1000}k
              </button>
            ))}
          </form>
          {synced && <span className="pu-sets">{synced}</span>}
        </div>
      </div>
    </section>
  );
}

/** 10k, 15k and 20k as three short bars that fill in turn. */
export function TierTrack({ steps }: { steps: number }) {
  const segs: Array<[number, number, string]> = [
    [0, 10_000, "10k"],
    [10_000, 15_000, "15k"],
    [15_000, 20_000, "20k"],
  ];
  return (
    <div className="tier-track" aria-hidden="true">
      {segs.map(([from, to, label]) => (
        <span key={label} className={`tier ${steps >= to ? "on" : ""}`}>
          <span className="tier-bar">
            <span style={{ width: `${Math.min(1, Math.max(0, (steps - from) / (to - from))) * 100}%` }} />
          </span>
          <span className="tier-label">{label}</span>
        </span>
      ))}
    </div>
  );
}
