import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { Env } from "./service";

export const SESSION_COOKIE = "sets_session";

export type Caller = { kind: "owner"; source: string } | { kind: "agent"; source: string };

const enc = new TextEncoder();

function safeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.byteLength !== bb.byteLength) return false;
  return crypto.subtle.timingSafeEqual(ab, bb);
}

/** Session value is derived from the password, so rotating APP_PASSWORD signs everyone out. */
export async function sessionValue(password: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("sets-owner-session-v1"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function checkPassword(env: Env, attempt: unknown): boolean {
  return !!env.APP_PASSWORD && typeof attempt === "string" && safeEqual(attempt, env.APP_PASSWORD);
}

function agentSource(c: Context): string {
  const name = (c.req.header("x-agent-name") ?? "").toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 32);
  return name ? `agent:${name}` : "agent";
}

export async function identify<E extends { Bindings: Env }>(c: Context<E>): Promise<Caller | null> {
  const env = c.env;
  const auth = c.req.header("authorization");
  if (auth) {
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (env.AGENT_TOKEN && safeEqual(token, env.AGENT_TOKEN)) return { kind: "agent", source: agentSource(c) };
    return null;
  }
  const cookie = getCookie(c, SESSION_COOKIE);
  if (cookie && env.APP_PASSWORD && safeEqual(cookie, await sessionValue(env.APP_PASSWORD))) {
    return { kind: "owner", source: "me" };
  }
  return null;
}
