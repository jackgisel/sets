import { exerciseAlias } from "../shared/parse";
import type { Entry, EntryStatus, Plan } from "../shared/types";

export interface Env {
  DB: D1Database;
  AI: Ai;
  ASSETS: Fetcher;
  APP_PASSWORD?: string;
  AGENT_TOKEN?: string;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BATCH = 200;

export function isDate(s: unknown): s is string {
  return typeof s === "string" && DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function optNum(v: unknown, field: string, { int = false, max = 100_000 } = {}): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > max) {
    throw new HttpError(400, `${field} must be a number between 0 and ${max}`);
  }
  return int ? Math.round(n) : Math.round(n * 100) / 100;
}

function optStr(v: unknown, field: string, max = 500): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") throw new HttpError(400, `${field} must be a string`);
  const s = v.trim();
  if (s.length > max) throw new HttpError(400, `${field} is too long (max ${max})`);
  return s || null;
}

function oneOf<T extends string>(v: unknown, field: string, allowed: readonly T[]): T | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "string") {
    const s = v.toLowerCase();
    const alias: Record<string, string> = { lbs: "lb", pounds: "lb", kgs: "kg", miles: "mi", mile: "mi" };
    const norm = (alias[s] ?? s) as T;
    if (allowed.includes(norm)) return norm;
  }
  throw new HttpError(400, `${field} must be one of ${allowed.join(", ")}`);
}

interface CleanEntry {
  date: string;
  exercise: string;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  unit: "lb" | "kg" | null;
  duration_min: number | null;
  distance: number | null;
  distance_unit: "mi" | "km" | null;
  notes: string | null;
  status: EntryStatus;
}

export function cleanEntry(raw: unknown, defaults: { date?: string; status?: EntryStatus }): CleanEntry {
  if (!raw || typeof raw !== "object") throw new HttpError(400, "each entry must be an object");
  const e = raw as Record<string, unknown>;
  const date = e.date ?? defaults.date;
  if (!isDate(date)) throw new HttpError(400, "date must be YYYY-MM-DD");
  const exercise = optStr(e.exercise ?? e.name ?? e.title, "exercise", 80);
  if (!exercise) throw new HttpError(400, "exercise is required");
  const status = oneOf(e.status, "status", ["planned", "done"] as const) ?? defaults.status ?? "done";
  const weight = optNum(e.weight, "weight", { max: 5000 });
  const distance = optNum(e.distance, "distance", { max: 1000 });
  return {
    date,
    exercise,
    sets: optNum(e.sets, "sets", { int: true, max: 1000 }),
    reps: optNum(e.reps, "reps", { int: true, max: 10_000 }),
    weight,
    unit: oneOf(e.unit, "unit", ["lb", "kg"] as const) ?? (weight != null ? "lb" : null),
    duration_min: optNum(e.duration_min, "duration_min", { max: 1440 }),
    distance,
    distance_unit: oneOf(e.distance_unit, "distance_unit", ["mi", "km"] as const) ?? (distance != null ? "mi" : null),
    notes: optStr(e.notes, "notes", 1000),
    status,
  };
}

/** Reuse the existing spelling of an exercise so progress charts group correctly. */
async function resolveExerciseNames(db: D1Database, names: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(names.map((n) => n.toLowerCase()))];
  if (unique.length === 0) return out;
  const rows = await db
    .prepare(
      `SELECT exercise FROM entries WHERE lower(exercise) IN (${unique.map(() => "?").join(",")}) GROUP BY lower(exercise)`,
    )
    .bind(...unique)
    .all<{ exercise: string }>();
  for (const r of rows.results) out.set(r.exercise.toLowerCase(), r.exercise);
  for (const n of names) {
    if (!out.has(n.toLowerCase())) out.set(n.toLowerCase(), exerciseAlias(n) ?? n.charAt(0).toUpperCase() + n.slice(1));
  }
  return out;
}

export async function createEntries(
  env: Env,
  rawEntries: unknown,
  opts: { source: string; date?: string; status?: EntryStatus; planId?: string | null },
): Promise<Entry[]> {
  const list = Array.isArray(rawEntries) ? rawEntries : [rawEntries];
  if (list.length === 0) throw new HttpError(400, "no entries provided");
  if (list.length > MAX_BATCH) throw new HttpError(400, `at most ${MAX_BATCH} entries per request`);
  const clean = list.map((r) => cleanEntry(r, { date: opts.date, status: opts.status }));
  const names = await resolveExerciseNames(
    env.DB,
    clean.map((c) => c.exercise),
  );
  const now = new Date().toISOString();

  const maxPos = await env.DB.prepare("SELECT COALESCE(MAX(position), 0) AS p FROM entries").first<{ p: number }>();
  let pos = maxPos?.p ?? 0;

  const created: Entry[] = clean.map((c) => ({
    id: crypto.randomUUID(),
    ...c,
    exercise: names.get(c.exercise.toLowerCase()) ?? c.exercise,
    plan_id: opts.planId ?? null,
    source: opts.source,
    position: ++pos,
    created_at: now,
    completed_at: c.status === "done" ? now : null,
  }));

  await env.DB.batch(
    created.map((e) =>
      env.DB.prepare(
        `INSERT INTO entries (id, date, exercise, sets, reps, weight, unit, duration_min, distance, distance_unit, notes, status, plan_id, source, position, created_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        e.id, e.date, e.exercise, e.sets, e.reps, e.weight, e.unit, e.duration_min, e.distance, e.distance_unit,
        e.notes, e.status, e.plan_id, e.source, e.position, e.created_at, e.completed_at,
      ),
    ),
  );
  return created;
}

export async function listEntries(
  env: Env,
  q: { from?: string | null; to?: string | null; status?: string | null; exercise?: string | null; limit?: number },
): Promise<Entry[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (q.from) {
    if (!isDate(q.from)) throw new HttpError(400, "from must be YYYY-MM-DD");
    where.push("date >= ?");
    args.push(q.from);
  }
  if (q.to) {
    if (!isDate(q.to)) throw new HttpError(400, "to must be YYYY-MM-DD");
    where.push("date <= ?");
    args.push(q.to);
  }
  if (q.status) {
    where.push("status = ?");
    args.push(oneOf(q.status, "status", ["planned", "done"] as const));
  }
  if (q.exercise) {
    where.push("lower(exercise) = lower(?)");
    args.push(q.exercise);
  }
  const limit = Math.min(Math.max(q.limit ?? 5000, 1), 10_000);
  const sql = `SELECT * FROM entries ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY date ASC, position ASC LIMIT ${limit}`;
  const res = await env.DB.prepare(sql).bind(...args).all<Entry>();
  return res.results;
}

const PATCHABLE = [
  "date", "exercise", "sets", "reps", "weight", "unit", "duration_min", "distance", "distance_unit", "notes", "status",
] as const;

export async function updateEntry(env: Env, id: string, patch: unknown): Promise<Entry> {
  const existing = await env.DB.prepare("SELECT * FROM entries WHERE id = ?").bind(id).first<Entry>();
  if (!existing) throw new HttpError(404, "entry not found");
  if (!patch || typeof patch !== "object") throw new HttpError(400, "body must be an object");
  const merged = { ...existing };
  for (const k of PATCHABLE) if (k in (patch as object)) (merged as Record<string, unknown>)[k] = (patch as Record<string, unknown>)[k];
  const clean = cleanEntry(merged, {});
  const completed_at =
    clean.status === "done" ? (existing.status === "done" ? existing.completed_at : new Date().toISOString()) : null;
  const next: Entry = { ...existing, ...clean, completed_at };
  await env.DB.prepare(
    `UPDATE entries SET date=?, exercise=?, sets=?, reps=?, weight=?, unit=?, duration_min=?, distance=?, distance_unit=?, notes=?, status=?, completed_at=? WHERE id=?`,
  )
    .bind(
      next.date, next.exercise, next.sets, next.reps, next.weight, next.unit, next.duration_min, next.distance,
      next.distance_unit, next.notes, next.status, next.completed_at, id,
    )
    .run();
  return next;
}

export async function deleteEntry(env: Env, id: string): Promise<void> {
  const res = await env.DB.prepare("DELETE FROM entries WHERE id = ?").bind(id).run();
  if (!res.meta.changes) throw new HttpError(404, "entry not found");
}

export async function createPlan(env: Env, body: unknown, createdBy: string): Promise<{ plan: Plan; entries: Entry[] }> {
  if (!body || typeof body !== "object") throw new HttpError(400, "body must be an object");
  const b = body as Record<string, unknown>;
  const title = optStr(b.title, "title", 120);
  if (!title) throw new HttpError(400, "title is required");
  const plan: Plan = {
    id: crypto.randomUUID(),
    title,
    notes: optStr(b.notes, "notes", 4000),
    created_by: createdBy,
    created_at: new Date().toISOString(),
  };
  let raw: unknown[] = [];
  if (Array.isArray(b.days)) {
    for (const day of b.days as Array<Record<string, unknown>>) {
      if (!day || !Array.isArray(day.entries)) throw new HttpError(400, "each day needs a date and entries[]");
      for (const e of day.entries) raw.push({ ...(e as object), date: (e as Record<string, unknown>).date ?? day.date });
    }
  } else if (Array.isArray(b.entries)) {
    raw = b.entries;
  }
  if (raw.length === 0) throw new HttpError(400, "a plan needs entries[] (each with a date) or days[]");
  // Validate everything before writing the plan row.
  raw.forEach((r) => cleanEntry(r, { status: "planned" }));
  await env.DB.prepare("INSERT INTO plans (id, title, notes, created_by, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(plan.id, plan.title, plan.notes, plan.created_by, plan.created_at)
    .run();
  const entries = await createEntries(
    env,
    raw.map((r) => ({ ...(r as object), status: "planned" })),
    { source: createdBy, status: "planned", planId: plan.id },
  );
  return { plan, entries };
}

export async function listPlans(env: Env) {
  const res = await env.DB.prepare(
    `SELECT p.*, 
       (SELECT COUNT(*) FROM entries e WHERE e.plan_id = p.id) AS total,
       (SELECT COUNT(*) FROM entries e WHERE e.plan_id = p.id AND e.status = 'done') AS done,
       (SELECT MIN(date) FROM entries e WHERE e.plan_id = p.id) AS start_date,
       (SELECT MAX(date) FROM entries e WHERE e.plan_id = p.id) AS end_date
     FROM plans p ORDER BY p.created_at DESC LIMIT 200`,
  ).all();
  return res.results;
}

/** Removes the plan and any of its entries that haven't been completed yet; completed work stays in the logbook. */
export async function deletePlan(env: Env, id: string): Promise<{ removed_planned: number }> {
  const plan = await env.DB.prepare("SELECT id FROM plans WHERE id = ?").bind(id).first();
  if (!plan) throw new HttpError(404, "plan not found");
  const [del] = await env.DB.batch([
    env.DB.prepare("DELETE FROM entries WHERE plan_id = ? AND status = 'planned'").bind(id),
    env.DB.prepare("UPDATE entries SET plan_id = NULL WHERE plan_id = ?").bind(id),
    env.DB.prepare("DELETE FROM plans WHERE id = ?").bind(id),
  ]);
  return { removed_planned: del.meta.changes ?? 0 };
}

export async function listExercises(env: Env) {
  const res = await env.DB.prepare(
    `SELECT exercise, COUNT(*) AS count, MAX(date) AS last_date, MAX(weight) AS max_weight
     FROM entries WHERE status = 'done' GROUP BY lower(exercise) ORDER BY count DESC LIMIT 500`,
  ).all();
  return res.results;
}

function streakEnding(days: Set<string>, today: string): number {
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Compact context for agents that want to write a plan. */
export async function summary(env: Env, today: string) {
  const since = addDays(today, -90);
  const done = await listEntries(env, { from: since, to: today, status: "done" });
  const upcoming = await listEntries(env, { from: today, status: "planned", limit: 200 });
  const days = new Set(done.map((e) => e.date));
  const byExercise = new Map<string, { exercise: string; sessions: number; last_date: string; best_weight: number | null; unit: string | null; last: Partial<Entry> }>();
  for (const e of done) {
    const key = e.exercise.toLowerCase();
    const cur = byExercise.get(key) ?? { exercise: e.exercise, sessions: 0, last_date: e.date, best_weight: null, unit: e.unit, last: {} };
    cur.sessions++;
    cur.last_date = e.date;
    if (e.weight != null && (cur.best_weight == null || e.weight > cur.best_weight)) {
      cur.best_weight = e.weight;
      cur.unit = e.unit;
    }
    cur.last = { sets: e.sets, reps: e.reps, weight: e.weight, unit: e.unit, duration_min: e.duration_min, distance: e.distance, distance_unit: e.distance_unit };
    byExercise.set(key, cur);
  }
  const last7 = new Set([...days].filter((d) => d > addDays(today, -7)));
  return {
    today,
    window: { from: since, to: today },
    workout_days_last_7: last7.size,
    workout_days_last_90: days.size,
    current_streak_days: streakEnding(days, today),
    exercises: [...byExercise.values()].sort((a, b) => b.sessions - a.sessions),
    recent_entries: done.slice(-40),
    upcoming_planned: upcoming,
  };
}
