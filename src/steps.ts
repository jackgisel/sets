import type { StepDay } from "../shared/types";
import { addDays, daysBetween, fromISO, startOfWeek } from "./dates";
import { MAX_SHIELDS, SHIELD_EVERY, type Achievement, type DayStatus } from "./pushups";

/**
 * The daily walk.
 *
 * - 10,000 steps closes the day. 15,000 and 20,000 are bonus laps.
 * - Same chain rules as push-ups: 7 days in a row earns a shield (bank up to 2), and a missed day spends one.
 * - Every step also moves you along the road from the Shire to Mount Doom, about 1,779 miles.
 *   At 10,000 a day that's roughly a year.
 */

export const STEP_GOAL = 10_000;
/** A rough average stride. Good enough for a map, not a survey. */
export const STEPS_PER_MILE = 2_000;
export const TIERS = [
  { at: 10_000, name: "Closed" },
  { at: 15_000, name: "Fifteen" },
  { at: 20_000, name: "Double" },
] as const;

export interface WalkDay {
  date: string;
  steps: number;
  status: DayStatus;
  /** 0 = under goal, 1 = 10k, 2 = 15k, 3 = 20k. */
  tier: number;
}

export interface Waypoint {
  name: string;
  miles: number;
  note: string;
}

/** Distances follow the usual fan reckoning of the Fellowship's road. */
export const WAYPOINTS: Waypoint[] = [
  { name: "Bag End", miles: 0, note: "It's a dangerous business, going out your door." },
  { name: "Bree", miles: 135, note: "The Prancing Pony. Mind the stranger in the corner." },
  { name: "Rivendell", miles: 458, note: "The Last Homely House. Rest a night." },
  { name: "Lothlórien", miles: 920, note: "Through Moria and out the other side." },
  { name: "Rauros", miles: 1309, note: "The Fellowship breaks. You keep walking." },
  { name: "Mount Doom", miles: 1779, note: "You walked to Mordor." },
  { name: "Home again", miles: 3558, note: "There and back again." },
];

export const STEP_ACHIEVEMENTS: Achievement[] = [
  { id: "first", title: "First ten thousand", detail: "Close your first day" },
  { id: "never-twice", title: "Never miss twice", detail: "Close the day right after a miss" },
  { id: "streak-7", title: "One week", detail: "7 days in a row" },
  { id: "perfect-week", title: "Perfect week", detail: "Close Monday through Sunday" },
  { id: "saved", title: "Shielded", detail: "A shield kept your streak alive" },
  { id: "day-15k", title: "Fifteen", detail: "15,000 in a day" },
  { id: "day-20k", title: "Double", detail: "20,000 in a day" },
  { id: "streak-30", title: "Thirty", detail: "30 days in a row" },
  { id: "week-100k", title: "Hundred-thousand week", detail: "100,000 between Monday and Sunday" },
  { id: "marathon", title: "Marathon", detail: "52,400 in a day, about 26.2 miles" },
  { id: "million", title: "Millionaire", detail: "1,000,000 lifetime" },
  { id: "streak-100", title: "Triple digits", detail: "100 days in a row" },
  { id: "mordor", title: "One does not simply walk", detail: "Reach Mount Doom" },
];

export function tierFor(steps: number): number {
  let t = 0;
  for (const tier of TIERS) if (steps >= tier.at) t++;
  return t;
}

export function milesFor(steps: number): number {
  return steps / STEPS_PER_MILE;
}

export function waypointFor(miles: number) {
  let i = 0;
  while (i + 1 < WAYPOINTS.length && miles >= WAYPOINTS[i + 1].miles) i++;
  const current = WAYPOINTS[i];
  const next = WAYPOINTS[i + 1] ?? null;
  const progress = next ? (miles - current.miles) / (next.miles - current.miles) : 1;
  return { index: i, current, next, progress, toNext: next ? next.miles - miles : 0 };
}

export interface Walk {
  today: string;
  start: string;
  dayNumber: number;
  days: WalkDay[];
  todayDay: WalkDay;
  steps: number;
  remaining: number;
  closedToday: boolean;
  streak: number;
  longest: number;
  shields: number;
  closedCount: number;
  lifetime: number;
  miles: number;
  bestDay: number;
  bestWeek: number;
  weekSteps: number;
  waypoint: ReturnType<typeof waypointFor>;
  unlocked: Set<string>;
  /** Average steps per day over the last 14 days, for projections. */
  pace: number;
}

export function computeWalk(log: StepDay[], today: string): Walk {
  const byDay = new Map<string, number>();
  for (const d of log) if (d.steps > 0 && d.date <= today) byDay.set(d.date, d.steps);
  const first = [...byDay.keys()].sort()[0];
  const start = first && first < today ? first : today;

  const days: WalkDay[] = [];
  const unlocked = new Set<string>();
  let closedCount = 0;
  let streak = 0;
  let longest = 0;
  let shields = 0;
  let prevMissed = false;

  for (let d = start; d <= today; d = addDays(d, 1)) {
    const steps = byDay.get(d) ?? 0;
    const closed = steps >= STEP_GOAL;
    let status: DayStatus;
    if (closed) {
      status = "closed";
      closedCount++;
      streak++;
      if (streak % SHIELD_EVERY === 0) shields = Math.min(MAX_SHIELDS, shields + 1);
      if (prevMissed) unlocked.add("never-twice");
      prevMissed = false;
    } else if (d === today) {
      status = "open";
    } else if (shields > 0) {
      status = "shielded";
      shields--;
      unlocked.add("saved");
      prevMissed = true;
    } else {
      status = "missed";
      streak = 0;
      prevMissed = true;
    }
    longest = Math.max(longest, streak);
    days.push({ date: d, steps, status, tier: tierFor(steps) });
    if (closed && fromISO(d).getDay() === 0 && days.length >= 7 && days.slice(-7).every((x) => x.status === "closed")) {
      unlocked.add("perfect-week");
    }
  }

  let lifetime = 0;
  let bestDay = 0;
  const weeks = new Map<string, number>();
  for (const [date, steps] of byDay) {
    lifetime += steps;
    bestDay = Math.max(bestDay, steps);
    const w = startOfWeek(date);
    weeks.set(w, (weeks.get(w) ?? 0) + steps);
  }
  const bestWeek = Math.max(0, ...weeks.values());
  const miles = milesFor(lifetime);

  if (closedCount > 0) unlocked.add("first");
  if (longest >= 7) unlocked.add("streak-7");
  if (longest >= 30) unlocked.add("streak-30");
  if (longest >= 100) unlocked.add("streak-100");
  if (bestDay >= 15_000) unlocked.add("day-15k");
  if (bestDay >= 20_000) unlocked.add("day-20k");
  if (bestDay >= 52_400) unlocked.add("marathon");
  if (bestWeek >= 100_000) unlocked.add("week-100k");
  if (lifetime >= 1_000_000) unlocked.add("million");
  if (miles >= 1779) unlocked.add("mordor");

  const todayDay = days[days.length - 1];
  let recent = 0;
  for (let i = 0; i < 14; i++) recent += byDay.get(addDays(today, -i)) ?? 0;

  return {
    today,
    start,
    dayNumber: daysBetween(start, today) + 1,
    days,
    todayDay,
    steps: todayDay.steps,
    remaining: Math.max(0, STEP_GOAL - todayDay.steps),
    closedToday: todayDay.status === "closed",
    streak,
    longest,
    shields,
    closedCount,
    lifetime,
    miles,
    bestDay,
    bestWeek,
    weekSteps: weeks.get(startOfWeek(today)) ?? 0,
    waypoint: waypointFor(miles),
    unlocked,
    pace: recent / 14,
  };
}

/** Days to the next waypoint at the recent pace, or null without one. */
export function daysToNextWaypoint(w: Walk): number | null {
  if (!w.waypoint.next || w.pace <= 0) return null;
  return Math.ceil((w.waypoint.toNext * STEPS_PER_MILE) / w.pace);
}

export function fmtSteps(n: number): string {
  return Math.round(n).toLocaleString();
}

export function fmtMiles(n: number): string {
  return n < 10 ? n.toFixed(1) : Math.round(n).toLocaleString();
}
