# Sets

A very simple workout tracker, dressed like [jackgisel.com](https://jackgisel.com): a dark canvas, a small text nav, and one narrow column.

- **Today / Upcoming / History**: every exercise is a to-do. Check it off when it's done.
- **Voice logging**: tap the mic and say *"3 sets of 10 bench at 135, then a 2 mile run"*. Whisper transcribes it, an LLM turns it into entries, and you confirm before anything is saved.
- **Type it**: tap **+** and type `squat 5x5 225, 20 min bike`. It's parsed as you type.
- **Progress**: a GitHub-style yearly heatmap, streaks, workouts per week, weekly volume, and a per-exercise chart that marks your PRs.
- **The daily push-up climb**: a ring to close every day. The goal starts where you are and rises one rep for every couple of days you close, so it only climbs when you do. Seven days in a row earns a shield that covers one miss. Lifetime reps rank you from Red to Gold (36,500, a year of hundreds), and there are 17 marks to unlock. **Count a set** turns the screen into a rep counter: put the phone under your chest and touch it with your nose.
- **10,000 steps a day**: a ring that closes at 10k, with bonus laps at 15k and 20k. Same chain rules as push-ups (seven days in a row earns a shield). Every step also walks you down the road from Bag End to Mount Doom (about 1,779 miles, roughly a year of 10k days), and there are 13 marks to unlock. Type the total from your phone, top it up with +1k/+2.5k/+5k, or sync it from an iPhone Shortcut (below).
- **Agents write your plans**: Grok (or any agent) can read your history and add planned workouts through MCP or REST. They show up in Upcoming as to-dos.

It runs on Cloudflare: a Worker serves the app and API, D1 stores the data, and Workers AI runs Whisper (`whisper-large-v3-turbo`) and Llama 3.3 for parsing. You don't need any other API keys.

## Deploy to `sets.jackgisel.com`

`wrangler.jsonc` already routes the Worker to `sets.jackgisel.com` as a custom domain (the `jackgisel.com` zone must be on Cloudflare). Wrangler creates the DNS record, certificate and the `sets` D1 database on the first deploy.

### Automatic (GitHub Actions)

Every push to `main` runs `.github/workflows/deploy.yml`: typecheck, tests, build, `wrangler deploy`, then D1 migrations. Add these repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Same kind of token the personal site uses; it needs Workers Scripts, D1, Workers Routes and DNS edit on the account/zone |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account id |
| `APP_PASSWORD` | Optional. The password you type to unlock the app; synced to the Worker on each deploy |
| `AGENT_TOKEN` | Optional. `openssl rand -hex 32`; agents send it as a Bearer token |

If you skip the last two, set them once by hand with `npx wrangler secret put APP_PASSWORD` / `AGENT_TOKEN`.

### By hand

```bash
npm install
npx wrangler login
npx wrangler secret put APP_PASSWORD
npx wrangler secret put AGENT_TOKEN
npm run deploy   # build, deploy, then apply migrations
```

If your Wrangler version asks for a `database_id`, run `npx wrangler d1 create sets` and paste the id into the `d1_databases` entry in `wrangler.jsonc`.

On iPhone, open the site in Safari and use **Share → Add to Home Screen** so it opens full-screen like an app.

## Connect Grok and other agents

Agents authenticate with `Authorization: Bearer <AGENT_TOKEN>`. They can also send `X-Agent-Name: grok` so plans are tagged with who wrote them.

| What | URL |
| --- | --- |
| MCP server (Streamable HTTP) | `https://sets.jackgisel.com/mcp` |
| OpenAPI spec | `https://sets.jackgisel.com/openapi.json` |
| Plain-text guide for LLMs | `https://sets.jackgisel.com/llms.txt` |

MCP tools: `get_summary`, `create_plan`, `list_plans`, `delete_plan`, `list_entries`, `log_workout`, `update_entry`, `delete_entry`, `log_steps`, `list_steps`.

### Sync steps from iPhone

Make a Shortcut automation (Time of Day, e.g. 9pm and 11:55pm):

1. **Find Health Samples**: Steps, start date is today, grouped by day.
2. **Calculate Statistics**: Sum.
3. **Get Contents of URL**: `POST https://sets.jackgisel.com/api/steps`, header `Authorization: Bearer <AGENT_TOKEN>`, JSON body `{"steps": <sum>, "date": "<Current Date as yyyy-MM-dd>"}`.

Each sync replaces that day's total, so running it more than once is fine. Send `"mode": "add"` to add instead. Without `date`, the Worker uses your local day based on Cloudflare's guess of your time zone.

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
      "server_url": "https://sets.jackgisel.com/mcp",
      "server_label": "sets",
      "authorization": "<AGENT_TOKEN>",
      "headers": { "X-Agent-Name": "grok" }
    }]
  }'
```

Or with plain REST:

```bash
curl -X POST https://sets.jackgisel.com/api/plans \
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
- `src/steps.ts`: the daily walk as pure functions (chain, tiers, waypoints, marks), tested in `src/steps.test.ts`; `src/useWalk.ts` turns changes into celebrations.
- `src/pushups.ts`: the push-up climb as pure functions (goals, streaks, shields, ranks, marks), tested in `src/pushups.test.ts`. `src/useJourney.ts` turns changes into celebrations; `src/feedback.ts` has the sounds, haptics and confetti.
- `migrations/`: D1 schema. Planned and done workouts live in one `entries` table; checking an item off flips `status` to `done`.
