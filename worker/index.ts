import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { parseLog, transcribe } from "./ai";
import { checkPassword, identify, SESSION_COOKIE, sessionValue, type Caller } from "./auth";
import { llmsTxt, openapi } from "./docs";
import { handleMcp } from "./mcp";
import {
  createEntries,
  createPlan,
  deleteEntry,
  deletePlan,
  HttpError,
  isDate,
  listEntries,
  listExercises,
  listPlans,
  summary,
  updateEntry,
  utcToday,
  type Env,
} from "./service";

type App = { Bindings: Env; Variables: { caller: Caller } };

const app = new Hono<App>();

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status as 400);
  if (err instanceof SyntaxError) return c.json({ error: "invalid JSON body" }, 400);
  console.error(err);
  return c.json({ error: "internal error" }, 500);
});

app.get("/openapi.json", (c) => c.json(openapi(new URL(c.req.url).origin)));
app.get("/llms.txt", (c) => c.text(llmsTxt(new URL(c.req.url).origin)));

app.post("/api/login", async (c) => {
  if (!c.env.APP_PASSWORD) return c.json({ error: "APP_PASSWORD is not configured on the server" }, 500);
  const { password } = await c.req.json<{ password?: string }>();
  if (!checkPassword(c.env, password)) {
    await new Promise((r) => setTimeout(r, 600));
    return c.json({ error: "wrong password" }, 401);
  }
  setCookie(c, SESSION_COOKIE, await sessionValue(c.env.APP_PASSWORD), {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return c.json({ ok: true });
});

app.post("/api/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

const requireAuth = async (c: import("hono").Context<App>, next: () => Promise<void>) => {
  const caller = await identify(c);
  if (!caller) return c.json({ error: "unauthorized" }, 401);
  c.set("caller", caller);
  await next();
};

app.use("/api/*", requireAuth);
app.use("/mcp", requireAuth);

app.get("/api/me", (c) => c.json({ kind: c.get("caller").kind }));

app.get("/api/entries", async (c) =>
  c.json({
    entries: await listEntries(c.env, {
      from: c.req.query("from"),
      to: c.req.query("to"),
      status: c.req.query("status"),
      exercise: c.req.query("exercise"),
      limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
    }),
  }),
);

app.post("/api/entries", async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  const source = c.get("caller").kind === "owner" && typeof body.source === "string" ? body.source.slice(0, 16) : c.get("caller").source;
  const entries = await createEntries(c.env, body.entries ?? body, { source });
  return c.json({ entries }, 201);
});

app.patch("/api/entries/:id", async (c) => c.json({ entry: await updateEntry(c.env, c.req.param("id"), await c.req.json()) }));

app.delete("/api/entries/:id", async (c) => {
  await deleteEntry(c.env, c.req.param("id"));
  return c.json({ ok: true });
});

app.get("/api/plans", async (c) => c.json({ plans: await listPlans(c.env) }));
app.post("/api/plans", async (c) => c.json(await createPlan(c.env, await c.req.json(), c.get("caller").source), 201));
app.delete("/api/plans/:id", async (c) => c.json(await deletePlan(c.env, c.req.param("id"))));

app.get("/api/exercises", async (c) => c.json({ exercises: await listExercises(c.env) }));

app.get("/api/summary", async (c) => {
  const today = c.req.query("today");
  return c.json(await summary(c.env, isDate(today) ? today : utcToday()));
});

async function knownNames(env: Env): Promise<string[]> {
  return ((await listExercises(env)) as Array<{ exercise: string }>).map((e) => e.exercise);
}

app.post("/api/parse", async (c) => {
  const { text } = await c.req.json<{ text?: string }>();
  if (typeof text !== "string") throw new HttpError(400, "text is required");
  return c.json({ text, ...(await parseLog(c.env, text, await knownNames(c.env))) });
});

app.post("/api/transcribe", async (c) => {
  const { audio } = await c.req.json<{ audio?: string }>();
  const text = await transcribe(c.env, audio);
  return c.json({ text, ...(await parseLog(c.env, text, await knownNames(c.env))) });
});

app.post("/mcp", async (c) => handleMcp(c.env, c.get("caller").source, await c.req.json()));
app.get("/mcp", (c) => c.json({ error: "use POST (stateless Streamable HTTP)" }, 405));

app.all("/api/*", (c) => c.json({ error: "not found" }, 404));

export default app;
