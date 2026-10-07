import type { Entry, EntryInput, ParsedItem } from "../shared/types";

export class Unauthorized extends Error {}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    credentials: "same-origin",
  });
  if (res.status === 401) throw new Unauthorized();
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export interface PlanRow {
  id: string;
  title: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  total: number;
  done: number;
  start_date: string | null;
  end_date: string | null;
}

export interface ExerciseRow {
  exercise: string;
  count: number;
  last_date: string;
  max_weight: number | null;
}

export interface ParseResult {
  text: string;
  items: ParsedItem[];
  parser: "ai" | "rules";
}

export const api = {
  me: () => req<{ kind: string }>("/api/me"),
  login: (password: string) => req("/api/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => req("/api/logout", { method: "POST" }),
  entries: (from: string, to: string) =>
    req<{ entries: Entry[] }>(`/api/entries?from=${from}&to=${to}`).then((r) => r.entries),
  create: (entries: EntryInput[], source = "manual") =>
    req<{ entries: Entry[] }>("/api/entries", { method: "POST", body: JSON.stringify({ entries, source }) }).then(
      (r) => r.entries,
    ),
  update: (id: string, patch: Partial<Entry>) =>
    req<{ entry: Entry }>(`/api/entries/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).then((r) => r.entry),
  remove: (id: string) => req(`/api/entries/${id}`, { method: "DELETE" }),
  plans: () => req<{ plans: PlanRow[] }>("/api/plans").then((r) => r.plans),
  removePlan: (id: string) => req(`/api/plans/${id}`, { method: "DELETE" }),
  exercises: () => req<{ exercises: ExerciseRow[] }>("/api/exercises").then((r) => r.exercises),
  parse: (text: string) => req<ParseResult>("/api/parse", { method: "POST", body: JSON.stringify({ text }) }),
  transcribe: (audio: string) => req<ParseResult>("/api/transcribe", { method: "POST", body: JSON.stringify({ audio }) }),
};
