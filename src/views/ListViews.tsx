import { useMemo, useState } from "react";
import type { Entry } from "../../shared/types";
import { EntryRow } from "../components/EntryRow";
import { Heatmap } from "../components/Heatmap";
import { FlameIcon } from "../components/Icons";
import { QuickAdd } from "../components/QuickAdd";
import { addDays, fmtDay, fromISO, relativeLabel, today } from "../dates";
import type { Store } from "../store";
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

export function TodayView({ store, adding, setAdding }: ViewProps) {
  const t = today();
  const list = store.entries.filter((e) => e.date === t);
  const overdue = store.entries.filter((e) => e.status === "planned" && e.date < t && e.date >= addDays(t, -7));
  const days = useMemo(() => dayStats(doneEntries(store.entries)), [store.entries]);
  const { current } = streaks(days);
  const doneCount = list.filter((e) => e.status === "done").length;

  return (
    <>
      <header className="view-head">
        <h1>
          <span className="h-icon yellow">
            <StarGlyph />
          </span>
          Today
        </h1>
        <div className="view-sub">
          {fmtDay(t, { weekday: "long", month: "long", day: "numeric" })}
          {current > 0 && (
            <span className="streak">
              <FlameIcon size={14} /> {current}-day streak
            </span>
          )}
        </div>
      </header>

      {adding && <QuickAdd store={store} date={t} status="done" onDone={() => setAdding(false)} />}
      <Rows list={list} store={store} />

      {!adding && list.length === 0 && (
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

function StarGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24">
      <path d="M12 2.8l2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.87l-5.5 2.88 1.05-6.12L3.1 9.3l6.15-.9L12 2.8z" fill="currentColor" />
    </svg>
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
        <h1>
          <span className="h-icon red">
            <CalGlyph />
          </span>
          Upcoming
        </h1>
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

function CalGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <rect x="3" y="4.5" width="18" height="16.5" rx="3.5" fill="currentColor" />
      <rect x="6.5" y="11" width="3" height="3" rx=".8" fill="#fff" />
      <rect x="10.5" y="11" width="3" height="3" rx=".8" fill="#fff" />
      <rect x="14.5" y="11" width="3" height="3" rx=".8" fill="#fff" />
      <rect x="6.5" y="15.5" width="3" height="3" rx=".8" fill="#fff" />
    </svg>
  );
}

export function LogbookView({ store }: ViewProps) {
  const t = today();
  const done = store.entries.filter((e) => e.status === "done").reverse();
  const groups = groupByDate(done);

  return (
    <>
      <header className="view-head">
        <h1>
          <span className="h-icon green">
            <svg width="24" height="24" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="4.5" fill="currentColor" />
              <path d="M7.5 12.3l3 3 6-6.3" stroke="#fff" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          Logbook
        </h1>
        <div className="view-sub">{done.length} exercises logged</div>
      </header>
      {groups.length === 0 && (
        <div className="empty static">
          <span className="empty-title">Your logbook is empty</span>
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
