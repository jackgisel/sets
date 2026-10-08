import { useEffect, useMemo, useRef, useState } from "react";
import { today } from "./dates";
import { chord, confetti, fanfare } from "./feedback";
import { ACHIEVEMENTS, computeJourney, QUOTES, RANKS, type Achievement, type Journey, type Rank } from "./pushups";
import type { Store } from "./store";

export interface Moment {
  key: number;
  closed: boolean;
  rankUp: Rank | null;
  achievements: Achievement[];
  quote: (typeof QUOTES)[number];
  journey: Journey;
}

/** Computes the push-up journey and turns changes in it (day closed, rank up, new marks) into moments to celebrate. */
export function useJourney(store: Store) {
  const settings = store.settings.pushups;
  const t = today();
  const journey = useMemo(
    () => (settings ? computeJourney(store.entries, settings, t) : null),
    [store.entries, settings, t],
  );
  const [moment, setMoment] = useState<Moment | null>(null);
  const prev = useRef<{ base: string; j: Journey } | null>(null);

  useEffect(() => {
    if (!journey || store.loading) return;
    // Only compare like with like: a settings change or a new day resets the baseline silently.
    const base = `${JSON.stringify(journey.settings)}|${journey.today}`;
    const before = prev.current;
    prev.current = { base, j: journey };
    if (!before || before.base !== base) return;

    const closed = !before.j.closedToday && journey.closedToday;
    const rankUp = journey.rank.index > before.j.rank.index ? journey.rank.current : null;
    const achievements = ACHIEVEMENTS.filter((a) => journey.unlocked.has(a.id) && !before.j.unlocked.has(a.id));
    if (!closed && !rankUp && achievements.length === 0) return;

    const color = journey.rank.current.color;
    if (closed || rankUp) {
      if (rankUp) fanfare();
      else chord();
      confetti(rankUp ? RANKS.slice(0, journey.rank.index + 1).map((r) => r.color) : [color, "#ffffff", "#5aa2ff", color]);
    }
    setMoment({
      key: Date.now(),
      closed,
      rankUp,
      achievements,
      quote: QUOTES[Math.floor(Math.random() * QUOTES.length)],
      journey,
    });
  }, [journey, store.loading]);

  return { journey, moment, dismiss: () => setMoment(null) };
}
