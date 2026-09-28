import type { ParsedItem } from "./types";

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** "three sets of twelve at one hundred thirty five" -> "3 sets of 12 at 135" */
export function wordsToDigits(text: string): string {
  const tokens = text.split(/(\s+|-)/);
  const out: string[] = [];
  let acc: number | null = null;
  let pendingSpace = "";

  const flush = () => {
    if (acc !== null) {
      out.push(String(acc));
      acc = null;
    }
    if (pendingSpace) {
      out.push(pendingSpace);
      pendingSpace = "";
    }
  };

  for (const tok of tokens) {
    if (/^(\s+|-)$/.test(tok)) {
      if (acc !== null) pendingSpace += tok;
      else out.push(tok);
      continue;
    }
    const m = tok.match(/^([A-Za-z]+)([^A-Za-z]*)$/);
    const word = m?.[1].toLowerCase();
    const trail = m?.[2] ?? "";
    let n: number | undefined;
    if (word && word in UNITS) n = UNITS[word];
    else if (word && word in TENS) n = TENS[word];

    if (n !== undefined) {
      if (acc === null) acc = n;
      else if (acc % 100 !== 0 && acc >= 20 && acc % 10 === 0 && n < 10) acc += n;
      else if (acc >= 100 && acc % 100 === 0 && n < 100) acc += n;
      else if (acc >= 100 && acc % 10 === 0 && n < 10) acc += n;
      else {
        flush();
        acc = n;
      }
      pendingSpace = "";
      if (trail) {
        flush();
        out.push(trail);
      }
      continue;
    }
    if (word === "hundred" && acc !== null && trail === "") {
      acc *= 100;
      pendingSpace = "";
      continue;
    }
    if (word === "hundred" && acc === null) {
      acc = 100;
      pendingSpace = "";
      continue;
    }
    flush();
    out.push(tok);
  }
  flush();
  return out.join("").replace(/\ba 100\b/gi, "100");
}

const ALIASES: Array<[RegExp, string]> = [
  [/^(ran|run|running|jog|jogged|jogging|a run|went running)$/, "Run"],
  [/^(walk|walked|walking|hike|hiked|hiking)$/, "Walk"],
  [/^(bike|biked|biking|bike ride|cycle|cycled|cycling|rode|ride|spin|spinning|peloton)$/, "Bike"],
  [/^(swim|swam|swimming)$/, "Swim"],
  [/^(row|rowed|rowing|erg)$/, "Row"],
  [/^push ?-? ?ups?$/, "Push-ups"],
  [/^pull ?-? ?ups?$/, "Pull-ups"],
  [/^chin ?-? ?ups?$/, "Chin-ups"],
  [/^sit ?-? ?ups?$/, "Sit-ups"],
  [/^(bench|benched|bench press|bench pressed|benching)$/, "Bench press"],
  [/^(squat|squats|squatted|back squats?)$/, "Squat"],
  [/^(deadlift|deadlifts|deadlifted|dead lifts?)$/, "Deadlift"],
  [/^(ohp|overhead press|overhead presses|military press|shoulder press)$/, "Overhead press"],
  [/^(dips?)$/, "Dips"],
  [/^(lunges?)$/, "Lunges"],
  [/^(planks?|planked)$/, "Plank"],
  [/^(burpees?)$/, "Burpees"],
  [/^(curls?|bicep curls?|biceps curls?)$/, "Bicep curls"],
  [/^(rows?|barbell rows?|bent over rows?)$/, "Barbell row"],
  [/^(yoga)$/, "Yoga"],
  [/^(stretch|stretched|stretching)$/, "Stretching"],
];

function normalizeName(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9 \-']/g, " ").replace(/\s+/g, " ").trim();
}

export function exerciseAlias(raw: string): string | null {
  const s = normalizeName(raw);
  for (const [re, name] of ALIASES) if (re.test(s)) return name;
  return null;
}

export function canonicalExercise(raw: string): string {
  const s = normalizeName(raw);
  if (!s) return "";
  return exerciseAlias(s) ?? s.charAt(0).toUpperCase() + s.slice(1);
}

const FILLER =
  /\b(i|i've|ive|i'm|im|we|just|did|do|done|doing|went|go|going|for|a|an|the|some|of|at|with|in|on|then|and|also|today|yesterday|this morning|this afternoon|this evening|tonight|last night|reps?|repetitions?|sets?|total|about|around|roughly|like|my|workout|session|um|uh|so|got|finished|completed|each|per|plus|after that|followed by|pounds?|lbs?|minutes?|mins?|miles?|km|times|x|yeah|yes|okay|ok|well|oh|hmm|basically|really|pretty|good|great)\b/gi;

function num(s: string | undefined): number | null {
  if (s === undefined) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseChunk(chunkIn: string): ParsedItem | null {
  let chunk = ` ${chunkIn.toLowerCase()} `;
  const item: ParsedItem = { exercise: "" };
  const take = (re: RegExp): RegExpMatchArray | null => {
    const m = chunk.match(re);
    if (m) chunk = chunk.replace(m[0], " ");
    return m;
  };

  let m: RegExpMatchArray | null;
  if ((m = take(/(\d+)\s*(?:x|×|by)\s*(\d+)/))) {
    item.sets = num(m[1]);
    item.reps = num(m[2]);
  } else if ((m = take(/(\d+)\s*sets?\s*(?:of\s*)?(\d+)\s*(?:reps?|repetitions?)?/))) {
    item.sets = num(m[1]);
    item.reps = num(m[2]);
  } else {
    if ((m = take(/(\d+)\s*sets?\b/))) item.sets = num(m[1]);
    if ((m = take(/(\d+)\s*(?:reps?|repetitions?|times)\b/))) item.reps = num(m[1]);
  }

  if ((m = take(/(?:@|\bat\b|\bwith\b)?\s*(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kgs?|kilos?|kilograms?)\b/))) {
    item.weight = num(m[1]);
    item.unit = /^k/.test(m[2]) ? "kg" : "lb";
  } else if ((m = take(/(?:@|\bat\b)\s*(\d+(?:\.\d+)?)\b/))) {
    item.weight = num(m[1]);
    item.unit = "lb";
  }

  if ((m = take(/(\d+(?:\.\d+)?)\s*-?\s*(hours?|hrs?|hr|h)\b/))) {
    item.duration_min = (num(m[1]) ?? 0) * 60;
  } else if ((m = take(/\b(?:an|one) hour\b/))) {
    item.duration_min = 60;
  } else if ((m = take(/\bhalf an hour\b/))) {
    item.duration_min = 30;
  }
  if ((m = take(/(\d+(?:\.\d+)?)\s*-?\s*(minutes?|mins?|min|m)\b/))) {
    item.duration_min = (item.duration_min ?? 0) + (num(m[1]) ?? 0);
  }
  if ((m = take(/(\d+(?:\.\d+)?)\s*-?\s*(seconds?|secs?|s)\b/))) {
    item.duration_min = (item.duration_min ?? 0) + Math.round(((num(m[1]) ?? 0) / 60) * 100) / 100;
  }

  if ((m = take(/(\d+(?:\.\d+)?)\s*-?\s*(miles?|mi|kilometers?|kilometres?|km|k)\b/))) {
    item.distance = num(m[1]);
    item.distance_unit = /^(mi)/.test(m[2]) ? "mi" : "km";
  }

  const bare = chunk.match(/\b(\d+(?:\.\d+)?)\b/);
  if (bare) {
    const n = num(bare[1]);
    chunk = chunk.replace(bare[0], " ");
    if (item.reps == null && item.sets == null && n !== null && n <= 500) item.reps = n;
    else if (item.weight == null) {
      item.weight = n;
      item.unit = "lb";
    }
  }

  const name = chunk.replace(FILLER, " ").replace(/[^a-z\- ']/g, " ").replace(/\s+/g, " ").trim();
  item.exercise = canonicalExercise(name);

  const hasNumbers =
    item.sets != null || item.reps != null || item.weight != null || item.duration_min != null || item.distance != null;
  if (!item.exercise) {
    if (item.distance != null) item.exercise = "Run";
    else if (hasNumbers) item.exercise = "Workout";
    else return null;
  }
  if (item.reps != null && item.sets == null) item.sets = 1;
  return item;
}

/** Deterministic parser for spoken/typed workout logs. Used when the LLM is unavailable and for instant previews. */
export function parseWorkoutText(text: string): ParsedItem[] {
  const normalized = wordsToDigits(text).replace(/(\d),(\d{3})/g, "$1$2");
  const dayOffset = /\byesterday\b|\blast night\b/i.test(normalized) ? -1 : 0;
  const chunks = normalized.split(
    /\s*(?:[,;\n]|\.(?!\d)|\bthen\b|\bafter that\b|\bfollowed by\b|\bplus\b|\band\b(?=\s+(?:\d|did|ran|walked|rode|swam|biked|rowed|i\b|then|some|a\b|an\b)))\s*/i,
  );
  const items: ParsedItem[] = [];
  for (const c of chunks) {
    if (!c || !c.trim()) continue;
    const it = parseChunk(c);
    if (it) {
      if (dayOffset) it.day_offset = dayOffset;
      items.push(it);
    }
  }
  return items;
}
