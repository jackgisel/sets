import {
  createEntries,
  createPlan,
  deleteEntry,
  deletePlan,
  HttpError,
  listEntries,
  listPlans,
  listSteps,
  putSteps,
  summary,
  updateEntry,
  utcToday,
  type Env,
} from "./service";

const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const entryProps = {
  date: { type: "string", description: "YYYY-MM-DD" },
  exercise: { type: "string", description: "e.g. 'Bench press', 'Run'. Reuse names from get_summary when possible." },
  sets: { type: "integer" },
  reps: { type: "integer", description: "Reps per set" },
  weight: { type: "number" },
  unit: { type: "string", enum: ["lb", "kg"] },
  duration_min: { type: "number" },
  distance: { type: "number" },
  distance_unit: { type: "string", enum: ["mi", "km"] },
  notes: { type: "string", description: "Coaching cues, RPE, rest times, etc." },
};

const TOOLS = [
  {
    name: "get_summary",
    description:
      "Get the owner's recent training: last 90 days of completed workouts, per-exercise bests and last performance, streak, and already-planned upcoming items. Call this before writing a plan.",
    inputSchema: {
      type: "object",
      properties: { today: { type: "string", description: "Owner's local date YYYY-MM-DD (defaults to UTC today)" } },
    },
  },
  {
    name: "create_plan",
    description:
      "Create a workout plan. Each entry is a planned exercise on a specific date and shows up as an unchecked to-do in the owner's Today/Upcoming lists. The owner checks items off as they do them.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "e.g. '4-week strength block'" },
        notes: { type: "string", description: "Overview / rationale shown with the plan" },
        entries: {
          type: "array",
          items: { type: "object", properties: entryProps, required: ["date", "exercise"] },
        },
      },
      required: ["title", "entries"],
    },
  },
  {
    name: "list_plans",
    description: "List plans with progress (done/total) and date ranges.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "delete_plan",
    description: "Delete a plan and its not-yet-completed items. Completed items are kept.",
    inputSchema: { type: "object", properties: { plan_id: { type: "string" } }, required: ["plan_id"] },
  },
  {
    name: "list_entries",
    description: "List workout entries (done or planned) in a date range.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        status: { type: "string", enum: ["planned", "done"] },
        exercise: { type: "string" },
      },
    },
  },
  {
    name: "log_workout",
    description: "Record exercises the owner already completed (status done) or add standalone planned items.",
    inputSchema: {
      type: "object",
      properties: {
        entries: {
          type: "array",
          items: {
            type: "object",
            properties: { ...entryProps, status: { type: "string", enum: ["done", "planned"] } },
            required: ["date", "exercise"],
          },
        },
      },
      required: ["entries"],
    },
  },
  {
    name: "update_entry",
    description: "Edit an entry (e.g. adjust weight, move date, mark done/planned).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" }, ...entryProps, status: { type: "string", enum: ["done", "planned"] } },
      required: ["id"],
    },
  },
  {
    name: "log_steps",
    description:
      "Record the owner's step count for a day. The daily goal is 10,000. mode 'set' (default) replaces the day's total, which is what a phone reports; 'add' adds to it.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD (defaults to UTC today)" },
        steps: { type: "integer" },
        mode: { type: "string", enum: ["set", "add"] },
      },
      required: ["steps"],
    },
  },
  {
    name: "list_steps",
    description: "List daily step counts in a date range.",
    inputSchema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } } },
  },
  {
    name: "delete_entry",
    description: "Delete a single entry.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
];

type Args = Record<string, unknown>;

async function callTool(env: Env, source: string, name: string, args: Args): Promise<unknown> {
  switch (name) {
    case "get_summary":
      return summary(env, typeof args.today === "string" ? args.today : utcToday());
    case "create_plan":
      return createPlan(env, args, source);
    case "list_plans":
      return listPlans(env);
    case "delete_plan":
      return deletePlan(env, String(args.plan_id ?? ""));
    case "list_entries":
      return listEntries(env, {
        from: args.from as string,
        to: args.to as string,
        status: args.status as string,
        exercise: args.exercise as string,
      });
    case "log_workout":
      return createEntries(env, args.entries, { source });
    case "update_entry": {
      const { id, ...patch } = args;
      return updateEntry(env, String(id ?? ""), patch);
    }
    case "log_steps":
      return putSteps(env, args, source);
    case "list_steps":
      return listSteps(env, { from: args.from as string, to: args.to as string });
    case "delete_entry":
      await deleteEntry(env, String(args.id ?? ""));
      return { ok: true };
    default:
      throw new HttpError(404, `unknown tool: ${name}`);
  }
}

interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

async function handleOne(env: Env, source: string, req: RpcRequest): Promise<object | null> {
  const isNotification = req.id === undefined || req.id === null;
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id: req.id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: req.id ?? null, error: { code, message } });

  switch (req.method) {
    case "initialize": {
      const asked = String(req.params?.protocolVersion ?? "");
      return ok({
        protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "sets", version: "1.0.0" },
        instructions:
          "Sets is the owner's workout tracker. Use get_summary to see recent training, then create_plan to schedule workouts as dated to-do items. Dates are YYYY-MM-DD in the owner's local calendar.",
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS });
    case "tools/call": {
      const name = String(req.params?.name ?? "");
      const args = (req.params?.arguments ?? {}) as Args;
      try {
        const result = await callTool(env, source, name, args);
        return ok({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: false });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return ok({ content: [{ type: "text", text: `Error: ${msg}` }], isError: true });
      }
    }
    default:
      if (isNotification) return null;
      return fail(-32601, `method not found: ${req.method}`);
  }
}

/** Stateless MCP over Streamable HTTP (JSON responses only). */
export async function handleMcp(env: Env, source: string, body: unknown): Promise<Response> {
  const batch = Array.isArray(body) ? body : [body];
  const results: object[] = [];
  for (const msg of batch) {
    if (!msg || typeof msg !== "object" || typeof (msg as RpcRequest).method !== "string") {
      results.push({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "invalid request" } });
      continue;
    }
    const r = await handleOne(env, source, msg as RpcRequest);
    if (r) results.push(r);
  }
  if (results.length === 0) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? results : results[0]);
}
