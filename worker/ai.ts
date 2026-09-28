import { canonicalExercise, parseWorkoutText } from "../shared/parse";
import type { ParsedItem } from "../shared/types";
import { HttpError, type Env } from "./service";

const WHISPER = "@cf/openai/whisper-large-v3-turbo";
const LLM = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_AUDIO_B64 = 8 * 1024 * 1024;

const WHISPER_PROMPT =
  "Workout log. Bench press, squat, deadlift, overhead press, pull-ups, push-ups, lunges, curls, plank, run, bike, row. 3 sets of 10 reps at 135 pounds. Ran 3 miles in 25 minutes.";

export async function transcribe(env: Env, audioB64: unknown): Promise<string> {
  if (typeof audioB64 !== "string" || audioB64.length < 100) throw new HttpError(400, "audio (base64 WAV) is required");
  if (audioB64.length > MAX_AUDIO_B64) throw new HttpError(413, "recording is too long; keep it under ~2 minutes");
  let out: { text?: string };
  try {
    out = (await env.AI.run(WHISPER, {
      audio: audioB64,
      language: "en",
      vad_filter: true,
      initial_prompt: WHISPER_PROMPT,
    } as never)) as { text?: string };
  } catch (err) {
    console.error("whisper failed", err);
    throw new HttpError(502, "Transcription is unavailable right now. Try again or type it instead.");
  }
  return (out.text ?? "").trim();
}

const ITEM_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          exercise: { type: "string" },
          sets: { type: ["integer", "null"] },
          reps: { type: ["integer", "null"] },
          weight: { type: ["number", "null"] },
          unit: { type: ["string", "null"], enum: ["lb", "kg", null] },
          duration_min: { type: ["number", "null"] },
          distance: { type: ["number", "null"] },
          distance_unit: { type: ["string", "null"], enum: ["mi", "km", null] },
          notes: { type: ["string", "null"] },
          day_offset: { type: "integer" },
        },
        required: ["exercise"],
      },
    },
  },
  required: ["items"],
} as const;

function systemPrompt(known: string[]) {
  return `You convert a person's spoken workout log into structured JSON.
Return {"items": [...]} with one item per exercise performed.
Rules:
- exercise: short, Title-case name. Prefer one of these existing names when it is the same movement: ${known.slice(0, 60).join(", ") || "(none yet)"}.
- sets/reps: "3 sets of 10" => sets 3, reps 10. "50 pushups" => sets 1, reps 50. If sets have different reps, use the most common rep count and put details in notes.
- weight + unit ("lb" or "kg"); default unit is lb. Bodyweight exercises have weight null.
- duration_min in minutes; distance + distance_unit ("mi" or "km") for cardio.
- day_offset: 0 for today, -1 if they said yesterday/last night, etc.
- Ignore filler, feelings and anything that isn't an exercise. If nothing was an exercise return {"items": []}.
- Never invent numbers that weren't said.`;
}

function toNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

function sanitize(items: unknown): ParsedItem[] {
  if (!Array.isArray(items)) return [];
  const out: ParsedItem[] = [];
  for (const raw of items.slice(0, 30)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const exercise = typeof r.exercise === "string" ? canonicalExercise(r.exercise) : "";
    if (!exercise) continue;
    const item: ParsedItem = { exercise };
    const sets = toNum(r.sets);
    const reps = toNum(r.reps);
    const weight = toNum(r.weight);
    const dur = toNum(r.duration_min);
    const dist = toNum(r.distance);
    if (sets != null) item.sets = Math.round(sets);
    if (reps != null) item.reps = Math.round(reps);
    if (weight != null && weight > 0) {
      item.weight = weight;
      item.unit = r.unit === "kg" ? "kg" : "lb";
    }
    if (dur != null && dur > 0) item.duration_min = dur;
    if (dist != null && dist > 0) {
      item.distance = dist;
      item.distance_unit = r.distance_unit === "km" ? "km" : "mi";
    }
    if (typeof r.notes === "string" && r.notes.trim()) item.notes = r.notes.trim().slice(0, 300);
    if (typeof r.day_offset === "number" && r.day_offset < 0 && r.day_offset > -30) item.day_offset = Math.round(r.day_offset);
    out.push(item);
  }
  return out;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, rej) => (t = setTimeout(() => rej(new Error("timeout")), ms)));
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (t !== undefined) clearTimeout(t);
  }
}

/** LLM parse with a deterministic fallback, so logging still works if the model is slow or down. */
export async function parseLog(
  env: Env,
  text: string,
  knownExercises: string[],
): Promise<{ items: ParsedItem[]; parser: "ai" | "rules" }> {
  const rules = parseWorkoutText(text);
  if (!text.trim()) return { items: [], parser: "rules" };
  try {
    const res = (await withTimeout(
      env.AI.run(LLM, {
        messages: [
          { role: "system", content: systemPrompt(knownExercises) },
          { role: "user", content: text.slice(0, 2000) },
        ],
        response_format: { type: "json_schema", json_schema: ITEM_SCHEMA },
        max_tokens: 1024,
        temperature: 0,
      } as never),
      12_000,
    )) as { response?: unknown };
    const body = typeof res.response === "string" ? JSON.parse(res.response) : res.response;
    const items = sanitize((body as { items?: unknown })?.items);
    if (items.length > 0 || rules.length === 0) return { items, parser: "ai" };
  } catch (err) {
    console.warn("LLM parse failed, using rules", err);
  }
  return { items: rules, parser: "rules" };
}
