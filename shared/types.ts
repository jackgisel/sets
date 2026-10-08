export type EntryStatus = "planned" | "done";
export type WeightUnit = "lb" | "kg";
export type DistanceUnit = "mi" | "km";

export interface Entry {
  id: string;
  date: string; // YYYY-MM-DD, in the owner's local calendar
  exercise: string;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  unit: WeightUnit | null;
  duration_min: number | null;
  distance: number | null;
  distance_unit: DistanceUnit | null;
  notes: string | null;
  status: EntryStatus;
  plan_id: string | null;
  source: string;
  position: number;
  created_at: string;
  completed_at: string | null;
}

export interface Plan {
  id: string;
  title: string;
  notes: string | null;
  created_by: string;
  created_at: string;
}

/** Fields a client or agent may supply when creating an entry. */
export interface EntryInput {
  date?: string;
  exercise: string;
  sets?: number | null;
  reps?: number | null;
  weight?: number | null;
  unit?: WeightUnit | null;
  duration_min?: number | null;
  distance?: number | null;
  distance_unit?: DistanceUnit | null;
  notes?: string | null;
  status?: EntryStatus;
}

/** A parsed item from speech/text, before it is saved. `day_offset` is relative to "today" (e.g. -1 = yesterday). */
export interface ParsedItem extends Omit<EntryInput, "date" | "status"> {
  day_offset?: number;
}

/** The daily push-up challenge. The goal starts at `base` and rises by 1 for every `step_every` days you close, up to `cap`. */
export interface PushupSettings {
  start_date: string;
  base: number;
  step_every: number;
  cap: number;
}

export interface Settings {
  pushups?: PushupSettings;
}

/** One day's step count. Phones report a running total, so a day holds one number that later writes replace. */
export interface StepDay {
  date: string;
  steps: number;
  source: string;
  updated_at: string;
}
