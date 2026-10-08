import { describe, expect, it } from "vitest";
import type { StepDay } from "../shared/types";
import { computeWalk, daysToNextWaypoint, tierFor, waypointFor } from "./steps";

const day = (date: string, steps: number): StepDay => ({ date, steps, source: "manual", updated_at: `${date}T20:00:00Z` });

describe("tierFor", () => {
  it("counts the goal and the bonus laps", () => {
    expect([0, 9_999, 10_000, 14_999, 15_000, 25_000].map(tierFor)).toEqual([0, 0, 1, 1, 2, 3]);
  });
});

describe("waypointFor", () => {
  it("finds where you are on the road", () => {
    expect(waypointFor(0).current.name).toBe("Bag End");
    const w = waypointFor(200);
    expect(w.current.name).toBe("Bree");
    expect(w.next?.name).toBe("Rivendell");
    expect(w.toNext).toBe(258);
  });
});

describe("computeWalk", () => {
  it("starts on the first logged day and keeps the chain", () => {
    const w = computeWalk([day("2026-10-01", 12_000), day("2026-10-02", 10_000), day("2026-10-04", 16_000), day("2026-10-05", 3_000)], "2026-10-05");
    expect(w.start).toBe("2026-10-01");
    expect(w.days.map((d) => d.status)).toEqual(["closed", "closed", "missed", "closed", "open"]);
    expect(w.streak).toBe(1);
    expect(w.longest).toBe(2);
    expect(w.remaining).toBe(7_000);
    expect(w.lifetime).toBe(41_000);
    expect(w.unlocked.has("never-twice")).toBe(true);
    expect(w.unlocked.has("day-15k")).toBe(true);
    expect(w.unlocked.has("day-20k")).toBe(false);
  });

  it("earns a shield every seven days and spends it on a miss", () => {
    const log = Array.from({ length: 7 }, (_, i) => day(`2026-10-0${i + 1}`, 10_000));
    log.push(day("2026-10-09", 11_000));
    const w = computeWalk(log, "2026-10-09");
    expect(w.days[7].status).toBe("shielded");
    expect(w.streak).toBe(8);
    expect(w.shields).toBe(0);
    expect(w.unlocked.has("saved")).toBe(true);
    expect(w.unlocked.has("streak-7")).toBe(true);
  });

  it("starts today with nothing logged", () => {
    const w = computeWalk([], "2026-10-08");
    expect(w.days).toHaveLength(1);
    expect(w.todayDay.status).toBe("open");
    expect(w.remaining).toBe(10_000);
    expect(daysToNextWaypoint(w)).toBeNull();
  });

  it("ignores days after today", () => {
    const w = computeWalk([day("2026-10-09", 12_000)], "2026-10-08");
    expect(w.lifetime).toBe(0);
  });
});
