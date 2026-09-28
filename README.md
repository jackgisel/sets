# Sets

A very simple workout tracker that looks and feels like Things 3.

- **Today / Upcoming / Logbook**: every exercise is a to-do. Check it off when it's done.
- **Voice logging**: tap the mic and say *"3 sets of 10 bench at 135, then a 2 mile run"*. Whisper transcribes it, an LLM turns it into entries, and you confirm before anything is saved.
- **Type it**: tap **+** and type `squat 5x5 225, 20 min bike`. It's parsed as you type.
- **Progress**: a GitHub-style yearly heatmap, streaks, workouts per week, weekly volume, and a per-exercise chart that marks your PRs.
- **Agents write your plans**: Grok (or any agent) can read your history and add planned workouts through MCP or REST. They show up in Upcoming as to-dos.

It runs on Cloudflare: a Worker serves the app and API, D1 stores the data, and Workers AI runs Whisper (`whisper-large-v3-turbo`) and Llama 3.3 for parsing. You don't need any other API keys.

## Deploy to `sets.yourdomain.com`

Your domain's DNS must be on Cloudflare.

```bash
npm install
npx wrangler login

# 1. Secrets
npx wrangler secret put APP_PASSWORD   # the password you'll type to unlock the app
openssl rand -hex 32                   # generate an agent token, then:
npx wrangler secret put AGENT_TOKEN    # paste it; agents send this as a Bearer token
```

2. In `wrangler.jsonc`, uncomment `routes` and set your subdomain:

```jsonc
"routes": [{ "pattern": "sets.yourdomain.com", "custom_domain": true }]
```

3. Deploy (builds, deploys, then applies database migrations):

```bash
npm run deploy
```

Wrangler creates the `sets` D1 database on the first deploy. If your Wrangler version asks for a `database_id` instead, run `npx wrangler d1 create sets` and paste the id into the `d1_databases` entry in `wrangler.jsonc`.

On iPhone, open the site in Safari and use **Share → Add to Home Screen** so it opens full-screen like an app.

## Connect Grok and other agents

Agents authenticate with `Authorization: Bearer <AGENT_TOKEN>`. They can also send `X-Agent-Name: grok` so plans are tagged with who wrote them.

| What | URL |
| --- | --- |
| MCP server (Streamable HTTP) | `https://sets.yourdomain.com/mcp` |
| OpenAPI spec | `https://sets.yourdomain.com/openapi.json` |
| Plain-text guide for LLMs | `https://sets.yourdomain.com/llms.txt` |

MCP tools: `get_summary`, `create_plan`, `list_plans`, `delete_plan`, `list_entries`, `log_workout`, `update_entry`, `delete_entry`.

Grok via the xAI API with remote MCP:

```bash
curl https://api.x.ai/v1/responses \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-4.7",
    "input": "Look at my last month and plan next week: 4 days, strength focus.",
    "tools": [{
      "type": "mcp",
      "server_url": "https://sets.yourdomain.com/mcp",
      "server_label": "sets",
      "authorization": "<AGENT_TOKEN>",
      "headers": { "X-Agent-Name": "grok" }
    }]
  }'
```

Or with plain REST:

```bash
curl -X POST https://sets.yourdomain.com/api/plans \
  -H "Authorization: Bearer $AGENT_TOKEN" -H "X-Agent-Name: grok" -H "Content-Type: application/json" \
  -d '{"title": "Week 1", "notes": "Leave 1-2 reps in reserve",
       "entries": [
         {"date": "2026-10-01", "exercise": "Bench press", "sets": 4, "reps": 6, "weight": 165},
         {"date": "2026-10-02", "exercise": "Run", "distance": 3, "distance_unit": "mi"}
       ]}'
```

Deleting a plan removes its unfinished items. Anything you already checked off stays in your Logbook.

## Local development

```bash
cp .dev.vars.example .dev.vars   # APP_PASSWORD / AGENT_TOKEN for local use
npm run dev                      # needs `wrangler login`; Workers AI always runs remotely
npm run dev:offline              # no Cloudflare account needed; voice is disabled and typed logs use the rule-based parser
npm test
npm run typecheck
```

## How it's built

- `src/`: React front end. Hand-rolled SVG charts and heatmap; no UI libraries.
- `worker/`: Hono API (`index.ts`), data layer (`service.ts`), Whisper and LLM parsing (`ai.ts`), MCP server (`mcp.ts`), and agent docs (`docs.ts`).
- `shared/parse.ts`: a deterministic parser for spoken or typed logs. It powers the live preview and is the fallback if the LLM is slow or down.
- `migrations/`: D1 schema. Planned and done workouts live in one `entries` table; checking an item off flips `status` to `done`.
