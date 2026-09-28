import type { Entry, ParsedItem } from "../shared/types";

type Metrics = Pick<Entry, "sets" | "reps" | "weight" | "unit" | "duration_min" | "distance" | "distance_unit">;

const trim = (n: number) => String(Math.round(n * 100) / 100);

export function fmtDuration(min: number): string {
  if (min < 1) return `${Math.round(min * 60)} sec`;
  if (min < 60) return `${trim(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function metricsLine(e: Partial<Metrics> | ParsedItem): string {
  const parts: string[] = [];
  if (e.sets != null && e.reps != null) parts.push(e.sets === 1 ? `${e.reps} reps` : `${e.sets} × ${e.reps}`);
  else if (e.sets != null) parts.push(`${e.sets} sets`);
  else if (e.reps != null) parts.push(`${e.reps} reps`);
  if (e.weight != null) parts.push(`${trim(e.weight)} ${e.unit ?? "lb"}`);
  if (e.distance != null) parts.push(`${trim(e.distance)} ${e.distance_unit ?? "mi"}`);
  if (e.duration_min != null) parts.push(fmtDuration(e.duration_min));
  return parts.join(" · ");
}

const LB_PER_KG = 2.20462;

export function volumeLb(e: Metrics): number {
  if (e.weight == null || e.reps == null) return 0;
  const w = e.unit === "kg" ? e.weight * LB_PER_KG : e.weight;
  return (e.sets ?? 1) * e.reps * w;
}

export function weightLb(e: Metrics): number | null {
  if (e.weight == null) return null;
  return e.unit === "kg" ? e.weight * LB_PER_KG : e.weight;
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${trim(n / 1000)}k`;
  return String(Math.round(n));
}

export function sourceLabel(source: string): string | null {
  if (source.startsWith("agent:")) {
    const name = source.slice(6);
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  if (source === "agent") return "Agent";
  return null;
}
