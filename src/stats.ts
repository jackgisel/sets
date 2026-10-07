import type { Entry } from "../shared/types";
import type { DayStat } from "./components/Heatmap";
import { addDays, fmtDay, startOfWeek, today } from "./dates";
import { volumeLb, weightLb } from "./format";

export function doneEntries(entries: Entry[]) {
  return entries.filter((e) => e.status === "done");
}

export function dayStats(done: Entry[]): Map<string, DayStat> {
  const m = new Map<string, DayStat>();
  for (const e of done) {
    const cur = m.get(e.date) ?? { count: 0, names: [] };
    cur.count++;
    if (!cur.names.includes(e.exercise)) cur.names.push(e.exercise);
    m.set(e.date, cur);
  }
  return m;
}

export function streaks(days: Map<string, DayStat>) {
  const t = today();
  let current = 0;
  let d = days.has(t) ? t : addDays(t, -1);
  while (days.has(d)) {
    current++;
    d = addDays(d, -1);
  }
  const sorted = [...days.keys()].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of sorted) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = day;
  }
  return { current, longest };
}

export interface WeekBucket {
  start: string;
  days: number;
  volume: number;
  minutes: number;
}

export function weekly(done: Entry[], weeks: number): WeekBucket[] {
  const thisWeek = startOfWeek(today());
  const buckets: WeekBucket[] = [];
  const index = new Map<string, WeekBucket>();
  for (let i = weeks - 1; i >= 0; i--) {
    const b = { start: addDays(thisWeek, -7 * i), days: 0, volume: 0, minutes: 0 };
    buckets.push(b);
    index.set(b.start, b);
  }
  const seen = new Set<string>();
  for (const e of done) {
    const b = index.get(startOfWeek(e.date));
    if (!b) continue;
    if (!seen.has(e.date)) {
      seen.add(e.date);
      b.days++;
    }
    b.volume += volumeLb(e);
    b.minutes += e.duration_min ?? 0;
  }
  return buckets;
}

export type Metric = "weight" | "volume" | "reps" | "distance" | "minutes";

/** Pick the most meaningful metric an exercise has been tracked with. */
export function pickMetric(list: Entry[]): Metric {
  if (list.some((e) => e.weight != null)) return "weight";
  if (list.some((e) => e.distance != null)) return "distance";
  if (list.some((e) => e.reps != null)) return "reps";
  return "minutes";
}

export function exerciseSeries(done: Entry[], exercise: string) {
  const list = done.filter((e) => e.exercise.toLowerCase() === exercise.toLowerCase());
  const metric = pickMetric(list);
  const byDay = new Map<string, number>();
  for (const e of list) {
    let v: number | null = null;
    if (metric === "weight") v = weightLb(e);
    else if (metric === "distance") v = e.distance_unit === "km" ? (e.distance ?? 0) * 0.621371 : e.distance;
    else if (metric === "reps") v = (e.sets ?? 1) * (e.reps ?? 0);
    else v = e.duration_min;
    if (v == null) continue;
    const agg = metric === "weight" ? Math.max(byDay.get(e.date) ?? 0, v) : (byDay.get(e.date) ?? 0) + v;
    byDay.set(e.date, agg);
  }
  const points = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, value]) => ({ label: fmtDay(date, { month: "short", day: "numeric" }), value: Math.round(value * 10) / 10, tip: fmtDay(date) }));
  return { metric, points, sessions: list.length };
}
