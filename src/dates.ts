const pad = (n: number) => String(n).padStart(2, "0");

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function today(): string {
  return toISO(new Date());
}

export function addDays(s: string, n: number): string {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000);
}

/** Monday-based start of week. */
export function startOfWeek(s: string): string {
  const d = fromISO(s);
  const dow = (d.getDay() + 6) % 7;
  return addDays(s, -dow);
}

export function fmtDay(s: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return fromISO(s).toLocaleDateString(undefined, opts);
}

export function relativeLabel(s: string, base = today()): string {
  const diff = daysBetween(base, s);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return fmtDay(s, { weekday: "long" });
  return fmtDay(s, { weekday: "short", month: "short", day: "numeric", year: fromISO(s).getFullYear() === fromISO(base).getFullYear() ? undefined : "numeric" });
}
