import { useEffect, useMemo, useRef, useState } from "react";
import { today } from "./dates";
import { chord, confetti, fanfare } from "./feedback";
import { QUOTES, type Achievement } from "./pushups";
import { computeWalk, STEP_ACHIEVEMENTS, type Walk, type Waypoint } from "./steps";
import type { Store } from "./store";

export interface WalkMoment {
  key: number;
  closed: boolean;
  /** The bonus lap just reached today: 2 = 15k, 3 = 20k, 0 = none. */
  tier: number;
  waypoint: Waypoint | null;
  achievements: Achievement[];
  quote: (typeof QUOTES)[number];
  walk: Walk;
}

const CONFETTI = ["#6b7a3a", "#a3ad78", "#e8b931", "#f4f3ec"];

/** Computes the daily walk and turns changes in it (10k, a bonus lap, a waypoint, new marks) into moments. */
export function useWalk(store: Store) {
  const t = today();
  const walk = useMemo(() => computeWalk(store.steps, t), [store.steps, t]);
  const [moment, setMoment] = useState<WalkMoment | null>(null);
  const prev = useRef<Walk | null>(null);

  useEffect(() => {
    if (store.loading) return;
    const before = prev.current;
    prev.current = walk;
    // A new day resets the baseline silently.
    if (!before || before.today !== walk.today) return;

    const closed = !before.closedToday && walk.closedToday;
    const tier = walk.todayDay.tier > Math.max(1, before.todayDay.tier) ? walk.todayDay.tier : 0;
    const waypoint = walk.waypoint.index > before.waypoint.index ? walk.waypoint.current : null;
    const achievements = STEP_ACHIEVEMENTS.filter((a) => walk.unlocked.has(a.id) && !before.unlocked.has(a.id));
    if (!closed && !tier && !waypoint && achievements.length === 0) return;

    if (waypoint) fanfare();
    else if (closed || tier) chord();
    if (closed || tier || waypoint) confetti(CONFETTI);
    setMoment({
      key: Date.now(),
      closed,
      tier,
      waypoint,
      achievements,
      quote: QUOTES[Math.floor(Math.random() * QUOTES.length)],
      walk,
    });
  }, [walk, store.loading]);

  return { walk, moment, dismiss: () => setMoment(null) };
}
