import { useState } from "react";
import { plink } from "../feedback";
import { isPushup, quickSets, type Journey } from "../pushups";
import type { Store } from "../store";
import { Counter } from "./Counter";
import { FlameIcon, ShieldIcon } from "./Icons";
import { Ring } from "./Ring";

export async function logPushups(store: Store, date: string, reps: number) {
  if (reps <= 0) return;
  plink();
  await store.add([{ exercise: "Push-ups", sets: 1, reps, date, status: "done" }], "pushups");
}

function hoursLeft() {
  const now = new Date();
  return 24 - now.getHours() - (now.getMinutes() > 0 ? 1 : 0);
}

export function statusLine(j: Journey): { text: string; tone: "ok" | "risk" | "muted" } {
  if (j.closedToday) {
    if (j.nextBumpIn === 0) return { text: `Closed. You're at the summit: ${j.goal} a day.`, tone: "ok" };
    return {
      text: j.nextBumpIn === j.settings.step_every ? `Closed. Tomorrow's goal: ${j.goal + 1}.` : `Closed. Goal rises in ${j.nextBumpIn} more ${j.nextBumpIn === 1 ? "day" : "days"}.`,
      tone: "ok",
    };
  }
  const left = hoursLeft();
  if (j.streak > 0 && left <= 6) {
    return {
      text: j.shields > 0 ? `${left}h left. A shield will cover a miss, but don't spend it.` : `${left}h left to keep a ${j.streak}-day streak.`,
      tone: "risk",
    };
  }
  if (j.reps === 0) return { text: j.dayNumber === 1 ? "Day one. The hardest part is starting." : "Start with one set.", tone: "muted" };
  return { text: `${j.remaining} to go.`, tone: "muted" };
}

export function PushupCard({ journey: j, store, onOpen }: { journey: Journey; store: Store; onOpen?(): void }) {
  const [counting, setCounting] = useState(false);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const color = j.rank.current.color;
  const status = statusLine(j);
  const todays = store.entries.filter((e) => e.date === j.today && e.status === "done" && isPushup(e));
  const last = todays[todays.length - 1];

  const add = async (n: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await logPushups(store, j.today, n);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`pu-card ${j.closedToday ? "closed" : ""}`} style={{ ["--ring" as string]: color }}>
      <div className="pu-main">
        <button type="button" className="pu-ring-btn" onClick={() => setCounting(true)} aria-label="Count reps">
          <Ring value={j.goal ? j.reps / j.goal : 0} size={124} stroke={11} color={color}>
            <span className="pu-reps">{j.reps}</span>
            <span className="pu-goal">of {j.goal}</span>
          </Ring>
        </button>
        <div className="pu-body">
          <div className="pu-title">
            <button type="button" className="pu-day" onClick={onOpen} disabled={!onOpen}>
              Push-ups <span className="pu-dayn">day {j.dayNumber}</span>
            </button>
            <span className="pu-badges">
              <span className={`pu-badge ${j.streak ? "lit" : ""}`} title="Streak">
                <FlameIcon size={13} /> {j.streak}
              </span>
              {Array.from({ length: j.shields }, (_, i) => (
                <span key={i} className="pu-badge shield" title="Shield: covers one missed day">
                  <ShieldIcon size={13} />
                </span>
              ))}
            </span>
          </div>
          <p className={`pu-status ${status.tone}`}>{status.text}</p>
          <div className="pu-chips">
            {quickSets(j).map((n) => (
              <button type="button" key={n} className="pu-chip" disabled={busy} onClick={() => add(n)}>
                +{n}
              </button>
            ))}
            <form
              className="pu-custom"
              onSubmit={(e) => {
                e.preventDefault();
                const n = Number(custom);
                if (n > 0) add(Math.round(n)).then(() => setCustom(""));
              }}
            >
              <input
                inputMode="numeric"
                type="number"
                min="1"
                placeholder="#"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                aria-label="Custom set"
              />
            </form>
          </div>
          <div className="pu-foot">
            <button type="button" className="btn primary small" onClick={() => setCounting(true)}>
              Count a set
            </button>
            {todays.length > 0 && (
              <span className="pu-sets">
                {todays.map((e) => (e.sets ?? 1) > 1 ? `${e.sets}×${e.reps}` : e.reps).join(" · ")}
                {last && (
                  <button type="button" className="link-btn" onClick={() => store.remove(last.id)}>
                    Undo
                  </button>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
      {counting && (
        <Counter
          remaining={j.remaining}
          color={color}
          onClose={() => setCounting(false)}
          onSave={(n) => {
            setCounting(false);
            add(n);
          }}
        />
      )}
    </section>
  );
}
