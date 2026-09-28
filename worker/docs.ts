const entrySchema = {
  type: "object",
  required: ["date", "exercise"],
  properties: {
    date: { type: "string", format: "date", example: "2026-10-01" },
    exercise: { type: "string", example: "Bench press" },
    sets: { type: "integer", example: 3 },
    reps: { type: "integer", example: 8 },
    weight: { type: "number", example: 155 },
    unit: { type: "string", enum: ["lb", "kg"] },
    duration_min: { type: "number" },
    distance: { type: "number" },
    distance_unit: { type: "string", enum: ["mi", "km"] },
    notes: { type: "string" },
    status: { type: "string", enum: ["planned", "done"], default: "done" },
  },
};

export function openapi(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Sets",
      version: "1.0.0",
      description:
        "Personal workout tracker. Agents authenticate with `Authorization: Bearer <AGENT_TOKEN>` and may send `X-Agent-Name: grok` for attribution. Planned entries appear as to-dos the owner checks off.",
    },
    servers: [{ url: origin }],
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
      schemas: { EntryInput: entrySchema },
    },
    security: [{ bearer: [] }],
    paths: {
      "/api/summary": {
        get: {
          operationId: "getSummary",
          summary: "Recent training context (90 days), per-exercise bests, streak, upcoming planned items",
          parameters: [{ name: "today", in: "query", schema: { type: "string", format: "date" } }],
          responses: { "200": { description: "Summary" } },
        },
      },
      "/api/plans": {
        get: { operationId: "listPlans", summary: "List plans", responses: { "200": { description: "Plans" } } },
        post: {
          operationId: "createPlan",
          summary: "Create a plan of dated, planned exercises",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title", "entries"],
                  properties: {
                    title: { type: "string" },
                    notes: { type: "string" },
                    entries: { type: "array", items: { $ref: "#/components/schemas/EntryInput" } },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Created plan and entries" } },
        },
      },
      "/api/plans/{id}": {
        delete: {
          operationId: "deletePlan",
          summary: "Delete a plan and its uncompleted items",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Deleted" } },
        },
      },
      "/api/entries": {
        get: {
          operationId: "listEntries",
          summary: "List entries",
          parameters: [
            { name: "from", in: "query", schema: { type: "string", format: "date" } },
            { name: "to", in: "query", schema: { type: "string", format: "date" } },
            { name: "status", in: "query", schema: { type: "string", enum: ["planned", "done"] } },
            { name: "exercise", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": { description: "Entries" } },
        },
        post: {
          operationId: "createEntries",
          summary: "Log completed exercises (or add planned ones)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["entries"],
                  properties: { entries: { type: "array", items: { $ref: "#/components/schemas/EntryInput" } } },
                },
              },
            },
          },
          responses: { "201": { description: "Created entries" } },
        },
      },
      "/api/entries/{id}": {
        patch: {
          operationId: "updateEntry",
          summary: "Update an entry",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: { content: { "application/json": { schema: { type: "object" } } } },
          responses: { "200": { description: "Updated entry" } },
        },
        delete: {
          operationId: "deleteEntry",
          summary: "Delete an entry",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Deleted" } },
        },
      },
    },
  };
}

export function llmsTxt(origin: string) {
  return `# Sets

> A personal workout tracker. You (an AI agent) can read the owner's training history and write workout plans for them.

Auth: send \`Authorization: Bearer <AGENT_TOKEN>\` on every request. Optionally send \`X-Agent-Name: <your-name>\` so the owner sees who wrote the plan.
Dates are YYYY-MM-DD in the owner's local calendar. Weights default to lb.

## Option A: MCP (recommended)
Remote MCP server (Streamable HTTP): ${origin}/mcp
Tools: get_summary, create_plan, list_plans, delete_plan, list_entries, log_workout, update_entry, delete_entry

## Option B: REST
OpenAPI spec: ${origin}/openapi.json

1. Read context: GET ${origin}/api/summary?today=2026-10-01
2. Write a plan:
   POST ${origin}/api/plans
   {"title": "Push/Pull/Legs week 1", "notes": "Leave 1-2 reps in reserve.",
    "entries": [
      {"date": "2026-10-01", "exercise": "Bench press", "sets": 4, "reps": 6, "weight": 165, "unit": "lb"},
      {"date": "2026-10-01", "exercise": "Pull-ups", "sets": 3, "reps": 8},
      {"date": "2026-10-02", "exercise": "Run", "distance": 3, "distance_unit": "mi", "notes": "easy pace"}
    ]}
3. Each planned entry shows as an unchecked to-do on its date. When the owner checks it off it becomes a completed workout.

Tips: reuse exercise names from get_summary so progress charts line up; base weights on each exercise's recent "last" and "best_weight".
`;
}
