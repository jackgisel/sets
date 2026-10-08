import { useCallback, useEffect, useState } from "react";
import type { Entry, EntryInput, PushupSettings, Settings, StepDay } from "../shared/types";
import { api, type ExerciseRow, type PlanRow, Unauthorized } from "./api";
import { addDays, today } from "./dates";

export interface Store {
  entries: Entry[];
  plans: PlanRow[];
  exercises: ExerciseRow[];
  settings: Settings;
  steps: StepDay[];
  loading: boolean;
  error: string | null;
  add(items: EntryInput[], source?: string): Promise<Entry[]>;
  update(id: string, patch: Partial<Entry>): Promise<void>;
  remove(id: string): Promise<void>;
  removePlan(id: string): Promise<void>;
  savePushups(value: PushupSettings): Promise<void>;
  saveSteps(date: string, steps: number, mode?: "set" | "add"): Promise<void>;
  reload(): Promise<void>;
}

const byOrder = (a: Entry, b: Entry) => (a.date === b.date ? a.position - b.position : a.date < b.date ? -1 : 1);

export function useStore(onUnauthorized: () => void): Store {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [steps, setSteps] = useState<StepDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const guard = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        setError(null);
        return await fn();
      } catch (err) {
        if (err instanceof Unauthorized) onUnauthorized();
        else setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [onUnauthorized],
  );

  const reload = useCallback(async () => {
    const t = today();
    const from = addDays(t, -400);
    await guard(async () => {
      // Push-ups older than the main window still count toward lifetime rank.
      // Steps come back in full: the walk's lifetime distance needs every day.
      const [e, old, p, x, s, st] = await Promise.all([
        api.entries(from, addDays(t, 365)),
        api.entries("2000-01-01", addDays(from, -1), "Push-ups"),
        api.plans(),
        api.exercises(),
        api.settings(),
        api.steps("2000-01-01", addDays(t, 1)),
      ]);
      setEntries([...old, ...e]);
      setPlans(p);
      setExercises(x);
      setSettings(s);
      setSteps(st);
    }).finally(() => setLoading(false));
  }, [guard]);

  useEffect(() => {
    reload().catch(() => {});
    const onFocus = () => document.visibilityState === "visible" && reload().catch(() => {});
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [reload]);

  const refreshMeta = useCallback(() => {
    Promise.all([api.plans(), api.exercises()])
      .then(([p, x]) => {
        setPlans(p);
        setExercises(x);
      })
      .catch(() => {});
  }, []);

  return {
    entries,
    plans,
    exercises,
    settings,
    steps,
    loading,
    error,
    reload,
    async add(items, source) {
      const created = await guard(() => api.create(items, source));
      setEntries((prev) => [...prev, ...created].sort(byOrder));
      refreshMeta();
      return created;
    },
    async update(id, patch) {
      const prev = entries;
      setEntries((cur) => cur.map((e) => (e.id === id ? { ...e, ...patch } : e)).sort(byOrder));
      try {
        const saved = await guard(() => api.update(id, patch));
        setEntries((cur) => cur.map((e) => (e.id === id ? saved : e)));
        refreshMeta();
      } catch {
        setEntries(prev);
      }
    },
    async remove(id) {
      const prev = entries;
      setEntries((cur) => cur.filter((e) => e.id !== id));
      try {
        await guard(() => api.remove(id));
        refreshMeta();
      } catch {
        setEntries(prev);
      }
    },
    async savePushups(value) {
      setSettings((cur) => ({ ...cur, pushups: value }));
      setSettings(await guard(() => api.savePushups(value)));
    },
    async saveSteps(date, n, mode = "set") {
      const prev = steps;
      const upsert = (day: StepDay) => (cur: StepDay[]) => [...cur.filter((d) => d.date !== day.date), day].sort((a, b) => (a.date < b.date ? -1 : 1));
      const old = steps.find((d) => d.date === date)?.steps ?? 0;
      setSteps(upsert({ date, steps: mode === "add" ? old + n : n, source: "manual", updated_at: new Date().toISOString() }));
      try {
        setSteps(upsert(await guard(() => api.saveSteps(date, n, mode))));
      } catch {
        setSteps(prev);
      }
    },
    async removePlan(id) {
      await guard(() => api.removePlan(id));
      await reload();
    },
  };
}
