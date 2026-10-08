import { describe, expect, it } from "vitest";
import type { Entry } from "../shared/types";
import { chainWeeks, computeJourney, goalFor, quickSets, rankFor } from "./pushups";

let n = 0;
function log(date: string, reps: number, opts: Partial<Entry> = {}): Entry {
  return {
    id: String(n++), date, exercise: "Push-ups", sets: 1, reps, weight: null, unit: null, duration_min: null,
    distance: null, distance_unit: null, notes: null, status: "done", plan_id: null, source: "manual", position: 0,
    created_at: `${date}T12:00:00`, completed_at: `${date}T12:00:00`, ...opts,
  };
}

const settings = { start_date: "2026-10-01", base: 20, step_every: 2, cap: 23 };

describe("goalFor", () => {
  it("climbs one rep per step and stops at the cap", () => {
    expect([0, 1, 2, 3, 4, 10].map((c) => goalFor(settings, c))).toEqual([20, 20, 21, 21, 22, 23]);
  });
});

describe("computeJourney", () => {
  it("only raises the goal on days you close", () => {
    const j = computeJourney(
      [log("2026-10-01", 20), log("2026-10-02", 20), log("2026-10-04", 21)],
      settings,
      "2026-10-05",
    );
    expect(j.days.map((d) => [d.goal, d.status])).toEqual([
      [20, "closed"],
      [20, "closed"],
      [21, "missed"],
      [21, "closed"],
      [21, "open"],
    ]);
    expect(j.streak).toBe(1);
    expect(j.longest).toBe(2);
    expect(j.unlocked.has("never-twice")).toBe(true);
    expect(j.nextBumpIn).toBe(1);
  });

  it("sums sets, matches spoken names, and ignores planned or other exercises", () => {
    const j = computeJourney(
      [
        log("2026-10-01", 10),
        log("2026-10-01", 5, { sets: 2, exercise: "pushups" }),
        log("2026-10-01", 50, { status: "planned" }),
        log("2026-10-01", 50, { exercise: "Squat" }),
      ],
      settings,
      "2026-10-01",
    );
    expect(j.reps).toBe(20);
    expect(j.closedToday).toBe(true);
    expect(j.todayDay.sets).toEqual([10, 5, 5]);
  });

  it("earns a shield every 7 days and spends it on a miss", () => {
    const s = { ...settings, base: 1, cap: 1 };
    const entries = Array.from({ length: 7 }, (_, i) => log(`2026-10-0${i + 1}`, 1));
    entries.push(log("2026-10-09", 1));
    const j = computeJourney(entries, s, "2026-10-09");
    expect(j.days[7].status).toBe("shielded");
    expect(j.streak).toBe(8);
    expect(j.shields).toBe(0);
    expect(j.unlocked.has("saved")).toBe(true);
    expect(j.unlocked.has("streak-7")).toBe(true);
  });

  it("does not break the streak while today is still open", () => {
    const j = computeJourney([log("2026-10-01", 20), log("2026-10-02", 20)], settings, "2026-10-03");
    expect(j.streak).toBe(2);
    expect(j.remaining).toBe(21);
  });

  it("unlocks time-of-day achievements from when the goal was crossed", () => {
    const j = computeJourney(
      [log("2026-10-01", 10, { completed_at: "2026-10-01T06:10:00" }), log("2026-10-01", 10, { completed_at: "2026-10-01T06:40:00" })],
      settings,
      "2026-10-01",
    );
    expect(j.todayDay.closedHour).toBe(6);
    expect(j.unlocked.has("early")).toBe(true);
  });

  it("pads the chain calendar to whole weeks", () => {
    const j = computeJourney([log("2026-10-01", 20)], settings, "2026-10-07");
    const weeks = chainWeeks(j);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter((d) => d && d.status !== "before").length).toBe(7);
    expect(quickSets(j).length).toBeGreaterThan(0);
  });
});

describe("rankFor", () => {
  it("rises Red to Gold", () => {
    expect(rankFor(0).current.name).toBe("Red");
    expect(rankFor(999).next?.name).toBe("Orange");
    expect(rankFor(36500).current.name).toBe("Gold");
    expect(rankFor(36500).next).toBeNull();
  });
});
