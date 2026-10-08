import { useMemo, useState } from "react";
import type { Entry } from "../../shared/types";
import { EntryRow } from "../components/EntryRow";
import { Heatmap } from "../components/Heatmap";
import { FlameIcon, RingIcon } from "../components/Icons";
import { PushupCard } from "../components/PushupCard";
import { StepsCard } from "../components/StepsCard";
import { QuickAdd } from "../components/QuickAdd";
import { addDays, fmtDay, fromISO, relativeLabel, today } from "../dates";
import type { Store } from "../store";
import { isPushup, type Journey } from "../pushups";
import type { Walk } from "../steps";
import { dayStats, doneEntries, streaks } from "../stats";

export interface ViewProps {
  store: Store;
  adding: boolean;
  setAdding(v: boolean): void;
}

function usePlanTitles(store: Store) {
  return useMemo(() => new Map(store.plans.map((p) => [p.id, p.title])), [store.plans]);
}

function Rows({ list, store }: { list: Entry[]; store: Store }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const titles = usePlanTitles(store);
  return (
    <div className="list">
      {list.map((e) => (
        <EntryRow
          key={e.id}
          entry={e}
          store={store}
          planTitle={e.plan_id ? titles.get(e.plan_id) : undefined}
          open={openId === e.id}
          onOpen={(o) => setOpenId(o ? e.id : null)}
        />
      ))}
    </div>
  );
}

export function TodayView({
  store,
  adding,
  setAdding,
  journey,
  walk,
  onPushups,
  onSteps,
}: ViewProps & { journey: Journey | null; walk: Walk; onPushups(): void; onSteps(): void }) {
  const t = today();
  // With the push-up challenge on, today's push-up sets live in the card instead of the list.
  const list = store.entries.filter((e) => e.date === t && !(journey && e.status === "done" && isPushup(e)));
  const overdue = store.entries.filter((e) => e.status === "planned" && e.date < t && e.date >= addDays(t, -7));
  const days = useMemo(() => dayStats(doneEntries(store.entries)), [store.entries]);
  const { current } = streaks(days);
  const doneCount = list.filter((e) => e.status === "done").length;

  return (
    <>
      <header className="view-head">
        <h1>Today</h1>
        <div className="view-sub">
          {fmtDay(t, { weekday: "long", month: "long", day: "numeric" })}
          {current > 0 && !journey && (
            <span className="streak">
              <FlameIcon size={14} /> {current}-day streak
            </span>
          )}
        </div>
      </header>

      <StepsCard walk={walk} store={store} onOpen={onSteps} />

      {journey ? (
        <PushupCard journey={journey} store={store} onOpen={onPushups} />
      ) : (
        <button type="button" className="pu-invite" onClick={onPushups}>
          <RingIcon size={18} pct={0.66} />
          <span>
            <b>Start the daily push-up climb</b>
            <span className="muted"> · every day, a little more</span>
          </span>
          <span className="muted">→</span>
        </button>
      )}

      {adding && <QuickAdd store={store} date={t} status="done" onDone={() => setAdding(false)} />}
      <Rows list={list} store={store} />

      {!adding && list.length === 0 && !journey && (
        <button type="button" className="empty" onClick={() => setAdding(true)}>
          <span className="empty-title">Nothing yet today</span>
          <span className="muted">Tap the mic and say what you did, or tap + to type it.</span>
        </button>
      )}

      {overdue.length > 0 && (
        <section className="section">
          <h2 className="section-title">Missed this week</h2>
          <Rows list={overdue} store={store} />
        </section>
      )}

      <section className="section">
        <h2 className="section-title">
          Last 20 weeks{doneCount ? ` · ${doneCount} done today` : ""}
        </h2>
        <Heatmap days={days} weeks={20} showLegend={false} />
      </section>
    </>
  );
}

function groupByDate(list: Entry[]) {
  const groups = new Map<string, Entry[]>();
  for (const e of list) groups.set(e.date, [...(groups.get(e.date) ?? []), e]);
  return [...groups.entries()];
}

export function UpcomingView({ store, adding, setAdding }: ViewProps) {
  const t = today();
  const [addDate, setAddDate] = useState(addDays(t, 1));
  const list = store.entries.filter((e) => e.date > t);
  const groups = groupByDate(list);

  return (
    <>
      <header className="view-head">
        <h1>Upcoming</h1>
        <div className="view-sub">Planned workouts from you and your agents</div>
      </header>

      {adding && (
        <div className="add-date">
          <label className="muted">
            For{" "}
            <input type="date" className="date-pill" value={addDate} min={addDays(t, 1)} onChange={(e) => e.target.value && setAddDate(e.target.value)} />
          </label>
          <QuickAdd store={store} date={addDate} status="planned" onDone={() => setAdding(false)} />
        </div>
      )}

      {groups.length === 0 && !adding && (
        <div className="empty static">
          <span className="empty-title">No plans yet</span>
          <span className="muted">Ask Grok (or any agent) to write you a plan — see Plans for how to connect it.</span>
        </div>
      )}

      {groups.map(([date, items]) => (
        <section key={date} className="day-group">
          <div className="day-head">
            <span className="day-num">{fromISO(date).getDate()}</span>
            <span className="day-label">{relativeLabel(date, t)}</span>
          </div>
          <Rows list={items} store={store} />
        </section>
      ))}
    </>
  );
}

export function LogbookView({ store }: ViewProps) {
  const t = today();
  const done = store.entries.filter((e) => e.status === "done").reverse();
  const groups = groupByDate(done);

  return (
    <>
      <header className="view-head">
        <h1>History</h1>
        <div className="view-sub">{done.length} exercises logged</div>
      </header>
      {groups.length === 0 && (
        <div className="empty static">
          <span className="empty-title">Nothing here yet</span>
          <span className="muted">Everything you check off shows up here.</span>
        </div>
      )}
      {groups.map(([date, items]) => (
        <section key={date} className="log-group">
          <h2 className="section-title">{relativeLabel(date, t)}</h2>
          <Rows list={items} store={store} />
        </section>
      ))}
    </>
  );
}
