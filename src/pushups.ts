import { exerciseAlias } from "../shared/parse";
import type { Entry, PushupSettings } from "../shared/types";
import { addDays, daysBetween, fromISO, startOfWeek } from "./dates";

/**
 * The daily push-up challenge.
 *
 * - Each day has a goal. It starts at `base` and goes up by one for every `step_every` days you close,
 *   so the climb only moves when you do. Missing a day never makes tomorrow harder.
 * - Every 7 days in a row earns a shield (bank up to 2). A missed day spends one and the streak survives.
 * - Rank comes from lifetime push-ups, Red to Gold. Gold is 36,500: a year of hundreds.
 */

export const PUSHUPS = "Push-ups";
export const MAX_SHIELDS = 2;
export const SHIELD_EVERY = 7;

export const DEFAULT_SETTINGS = (start: string): PushupSettings => ({ start_date: start, base: 20, step_every: 2, cap: 100 });

export function isPushup(e: Pick<Entry, "exercise">): boolean {
  return e.exercise.toLowerCase() === "push-ups" || exerciseAlias(e.exercise) === PUSHUPS;
}

export function repsOf(e: Pick<Entry, "sets" | "reps">): number {
  return (e.sets ?? 1) * (e.reps ?? 0);
}

export type DayStatus = "closed" | "shielded" | "missed" | "open" | "before";

export interface PushDay {
  date: string;
  reps: number;
  goal: number;
  sets: number[];
  status: DayStatus;
  /** When the goal was reached, as a local hour (0–23). */
  closedHour: number | null;
}

export interface Rank {
  name: string;
  at: number;
  color: string;
}

/** Lifetime push-ups. The colors rise the way Darrow did. */
export const RANKS: Rank[] = [
  { name: "Red", at: 0, color: "#e5484d" },
  { name: "Brown", at: 250, color: "#ad7f58" },
  { name: "Orange", at: 1000, color: "#f76b15" },
  { name: "Green", at: 2500, color: "#30a46c" },
  { name: "Blue", at: 5000, color: "#3e8bff" },
  { name: "Violet", at: 9000, color: "#9d6bf0" },
  { name: "Copper", at: 15000, color: "#d6825a" },
  { name: "Silver", at: 24000, color: "#c4c8cf" },
  { name: "Gold", at: 36500, color: "#e8b931" },
];

export function rankFor(lifetime: number) {
  let i = 0;
  while (i + 1 < RANKS.length && lifetime >= RANKS[i + 1].at) i++;
  const current = RANKS[i];
  const next = RANKS[i + 1] ?? null;
  const progress = next ? (lifetime - current.at) / (next.at - current.at) : 1;
  return { index: i, current, next, progress, toNext: next ? next.at - lifetime : 0 };
}

export interface Achievement {
  id: string;
  title: string;
  detail: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "day-one", title: "Day one", detail: "Close your first day" },
  { id: "never-twice", title: "Never miss twice", detail: "Close the day right after a miss" },
  { id: "streak-7", title: "One week", detail: "7 days in a row" },
  { id: "perfect-week", title: "Perfect week", detail: "Close Monday through Sunday" },
  { id: "streak-30", title: "Thirty", detail: "30 days in a row" },
  { id: "saved", title: "Shielded", detail: "A shield kept your streak alive" },
  { id: "set-25", title: "Unbroken 25", detail: "25 in a single set" },
  { id: "double", title: "Overachiever", detail: "Do double the day's goal" },
  { id: "early", title: "Before the world wakes", detail: "Close the day before 7am" },
  { id: "late", title: "Who's gonna carry the boats", detail: "Close the day after 10pm" },
  { id: "century", title: "Century", detail: "100 in one day" },
  { id: "total-1k", title: "1,000", detail: "1,000 lifetime" },
  { id: "set-50", title: "Unbroken 50", detail: "50 in a single set" },
  { id: "streak-100", title: "Triple digits", detail: "100 days in a row" },
  { id: "cap", title: "Summit", detail: "Your goal reaches its cap" },
  { id: "total-10k", title: "10,000", detail: "10,000 lifetime" },
  { id: "streak-365", title: "Journey before destination", detail: "365 days in a row" },
];

export interface Journey {
  settings: PushupSettings;
  today: string;
  dayNumber: number;
  days: PushDay[];
  todayDay: PushDay;
  goal: number;
  reps: number;
  remaining: number;
  closedToday: boolean;
  streak: number;
  longest: number;
  shields: number;
  /** Closed days still needed before the goal goes up (0 at the cap). */
  nextBumpIn: number;
  closedCount: number;
  lifetime: number;
  bestDay: number;
  bestSet: number;
  rank: ReturnType<typeof rankFor>;
  unlocked: Set<string>;
  /** Average reps per day over the last 14 days, for projections. */
  pace: number;
}

interface RawDay {
  reps: number;
  sets: number[];
  stamps: Array<{ at: string; reps: number }>;
}

function groupDays(entries: Entry[]) {
  const byDay = new Map<string, RawDay>();
  for (const e of entries) {
    if (e.status !== "done" || !isPushup(e)) continue;
    const n = repsOf(e);
    if (n <= 0) continue;
    const d = byDay.get(e.date) ?? { reps: 0, sets: [], stamps: [] };
    d.reps += n;
    for (let i = 0; i < (e.sets ?? 1); i++) d.sets.push(e.reps ?? 0);
    d.stamps.push({ at: e.completed_at ?? e.created_at, reps: n });
    byDay.set(e.date, d);
  }
  return byDay;
}

function hourClosed(raw: RawDay, goal: number): number | null {
  let sum = 0;
  for (const s of [...raw.stamps].sort((a, b) => (a.at < b.at ? -1 : 1))) {
    sum += s.reps;
    if (sum >= goal) return new Date(s.at).getHours();
  }
  return null;
}

export function goalFor(settings: PushupSettings, closedBefore: number): number {
  return Math.min(settings.cap, settings.base + Math.floor(closedBefore / settings.step_every));
}

export function computeJourney(entries: Entry[], settings: PushupSettings, today: string): Journey {
  const byDay = groupDays(entries);
  const start = settings.start_date <= today ? settings.start_date : today;
  const days: PushDay[] = [];
  const unlocked = new Set<string>();

  let closedCount = 0;
  let streak = 0;
  let longest = 0;
  let shields = 0;
  let prevMissed = false;

  for (let d = start; d <= today; d = addDays(d, 1)) {
    const raw = byDay.get(d);
    const reps = raw?.reps ?? 0;
    const goal = goalFor(settings, closedCount);
    const closed = reps >= goal;
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
    const closedHour = closed && raw ? hourClosed(raw, goal) : null;
    days.push({ date: d, reps, goal, sets: raw?.sets ?? [], status, closedHour });

    if (closed) {
      if (reps >= goal * 2) unlocked.add("double");
      if (closedHour != null && closedHour < 7) unlocked.add("early");
      if (closedHour != null && closedHour >= 22) unlocked.add("late");
      if (goal >= settings.cap) unlocked.add("cap");
      // A perfect week ends on a closed Sunday whose previous six days were closed too.
      if (fromISO(d).getDay() === 0 && days.length >= 7 && days.slice(-7).every((x) => x.status === "closed")) {
        unlocked.add("perfect-week");
      }
    }
  }

  let lifetime = 0;
  let bestDay = 0;
  let bestSet = 0;
  for (const raw of byDay.values()) {
    lifetime += raw.reps;
    bestDay = Math.max(bestDay, raw.reps);
    for (const s of raw.sets) bestSet = Math.max(bestSet, s);
  }

  if (closedCount > 0) unlocked.add("day-one");
  if (longest >= 7) unlocked.add("streak-7");
  if (longest >= 30) unlocked.add("streak-30");
  if (longest >= 100) unlocked.add("streak-100");
  if (longest >= 365) unlocked.add("streak-365");
  if (bestDay >= 100) unlocked.add("century");
  if (bestSet >= 25) unlocked.add("set-25");
  if (bestSet >= 50) unlocked.add("set-50");
  if (lifetime >= 1000) unlocked.add("total-1k");
  if (lifetime >= 10000) unlocked.add("total-10k");

  const todayDay = days[days.length - 1];
  const goal = todayDay.goal;
  const closedToday = todayDay.status === "closed";
  // Closing today counts toward the next bump, so measure from the goal tomorrow would have.
  const atCap = goalFor(settings, closedCount) >= settings.cap;
  const nextBumpIn = atCap ? 0 : settings.step_every - (closedCount % settings.step_every);

  let recent = 0;
  for (let i = 0; i < 14; i++) recent += byDay.get(addDays(today, -i))?.reps ?? 0;

  return {
    settings,
    today,
    dayNumber: daysBetween(start, today) + 1,
    days,
    todayDay,
    goal,
    reps: todayDay.reps,
    remaining: Math.max(0, goal - todayDay.reps),
    closedToday,
    streak,
    longest,
    shields,
    nextBumpIn,
    closedCount,
    lifetime,
    bestDay,
    bestSet,
    rank: rankFor(lifetime),
    unlocked,
    pace: recent / 14,
  };
}

/** Days until the next rank at the recent pace, or null if there's no pace yet. */
export function daysToNextRank(j: Journey): number | null {
  if (!j.rank.next || j.pace <= 0) return null;
  return Math.ceil(j.rank.toNext / j.pace);
}

/** Week-aligned rows of the journey for the chain calendar, oldest first, padded to whole weeks. */
export function chainWeeks(j: Journey, maxWeeks = 26): Array<Array<PushDay | null>> {
  const first = startOfWeek(j.days[0].date);
  const byDate = new Map(j.days.map((d) => [d.date, d]));
  const weeks: Array<Array<PushDay | null>> = [];
  for (let w = startOfWeek(j.today); w >= first && weeks.length < maxWeeks; w = addDays(w, -7)) {
    const row: Array<PushDay | null> = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(w, i);
      row.push(byDate.get(d) ?? (d < j.days[0].date ? { date: d, reps: 0, goal: 0, sets: [], status: "before", closedHour: null } : null));
    }
    weeks.unshift(row);
  }
  return weeks;
}

/** Suggested quick-add set sizes, built from what you actually do. */
export function quickSets(j: Journey): number[] {
  const counts = new Map<number, number>();
  for (const d of j.days.slice(-21)) for (const s of d.sets) counts.set(s, (counts.get(s) ?? 0) + 1);
  const favorites = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, 2);
  const set = new Set([...favorites, 5, 10, 20]);
  if (j.remaining > 0 && j.remaining <= 50) set.add(j.remaining);
  return [...set].filter((n) => n > 0).sort((a, b) => a - b).slice(0, 5);
}

export const QUOTES: Array<{ text: string; by: string }> = [
  { text: "Life before death. Strength before weakness. Journey before destination.", by: "The Way of Kings" },
  { text: "Break the chains.", by: "Red Rising" },
  { text: "Every action you take is a vote for the type of person you wish to become.", by: "James Clear" },
  { text: "You do not rise to the level of your goals. You fall to the level of your systems.", by: "James Clear" },
  { text: "Who's gonna carry the boats?", by: "David Goggins" },
  { text: "Fear is the mind-killer.", by: "Dune" },
  { text: "The enemy's gate is down.", by: "Ender's Game" },
  { text: "Amaze! Amaze! Amaze!", by: "Rocky, Project Hail Mary" },
  { text: "The cowards never started and the weak died along the way. That leaves us.", by: "Shoe Dog" },
  { text: "The hardest part for me is getting started and avoiding perfectionism.", by: "You, in 2022. You started." },
  { text: "Per aspera ad astra.", by: "Red Rising" },
  { text: "Never miss twice.", by: "James Clear" },
];

export function pickQuote(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return QUOTES[Math.abs(h) % QUOTES.length];
}
