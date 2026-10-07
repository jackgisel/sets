import { useState } from "react";
import { TrashIcon } from "../components/Icons";
import { fmtDay } from "../dates";
import { sourceLabel } from "../format";
import type { Store } from "../store";

export function PlansView({ store }: { store: Store }) {
  const origin = window.location.origin;
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <>
      <header className="view-head">
        <h1>
          <span className="h-icon blue">
            <svg width="24" height="24" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="2.4" fill="none" />
              <path d="M12 3.4a8.6 8.6 0 0 1 8.6 8.6H12V3.4z" fill="currentColor" />
            </svg>
          </span>
          Plans
        </h1>
        <div className="view-sub">Programs written by you or your agents</div>
      </header>

      {store.plans.length === 0 && (
        <div className="empty static">
          <span className="empty-title">No plans yet</span>
          <span className="muted">Connect an agent below and ask it to plan your next few weeks.</span>
        </div>
      )}

      <div className="plans">
        {store.plans.map((p) => {
          const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
          const by = sourceLabel(p.created_by);
          return (
            <div key={p.id} className="plan">
              <div className="plan-ring" style={{ ["--pct" as string]: pct }} aria-label={`${pct}% complete`} />
              <div className="plan-body">
                <div className="row-title">{p.title}</div>
                <div className="row-meta">
                  {p.done}/{p.total} done
                  {p.start_date && ` · ${fmtDay(p.start_date, { month: "short", day: "numeric" })}`}
                  {p.end_date && p.end_date !== p.start_date && ` – ${fmtDay(p.end_date, { month: "short", day: "numeric" })}`}
                  {by && <span className="tag tag-agent">{by}</span>}
                </div>
                {p.notes && <p className="plan-notes">{p.notes}</p>}
              </div>
              <button
                type="button"
                className="icon-btn danger"
                aria-label="Delete plan"
                onClick={() => {
                  if (confirm(`Delete “${p.title}”? Unfinished items are removed; finished ones stay in your logbook.`)) store.removePlan(p.id);
                }}
              >
                <TrashIcon size={18} />
              </button>
            </div>
          );
        })}
      </div>

      <section className="panel agent-panel">
        <h2 className="panel-title">Let agents write plans</h2>
        <p className="muted small">
          Grok, ChatGPT, Claude or any bot can read your history and add planned workouts. They show up in Upcoming as
          to-dos you check off. Agents authenticate with your <code>AGENT_TOKEN</code> secret.
        </p>
        <CopyRow label="MCP server" value={`${origin}/mcp`} copied={copied === "mcp"} onCopy={() => copy("mcp", `${origin}/mcp`)} />
        <CopyRow label="OpenAPI" value={`${origin}/openapi.json`} copied={copied === "oa"} onCopy={() => copy("oa", `${origin}/openapi.json`)} />
        <CopyRow label="Agent guide" value={`${origin}/llms.txt`} copied={copied === "llms"} onCopy={() => copy("llms", `${origin}/llms.txt`)} />
        <details className="snippet">
          <summary>Example: Grok API with remote MCP</summary>
          <pre>{`curl https://api.x.ai/v1/responses \\
  -H "Authorization: Bearer $XAI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "grok-4.7",
    "input": "Look at my last month and plan next week: 4 days, strength focus.",
    "tools": [{
      "type": "mcp",
      "server_url": "${origin}/mcp",
      "server_label": "sets",
      "authorization": "<AGENT_TOKEN>",
      "headers": { "X-Agent-Name": "grok" }
    }]
  }'`}</pre>
        </details>
      </section>

      <button type="button" className="link-btn logout" onClick={() => fetch("/api/logout", { method: "POST" }).then(() => location.reload())}>
        Sign out
      </button>
    </>
  );
}

function CopyRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy(): void }) {
  return (
    <div className="copy-row">
      <span className="copy-label">{label}</span>
      <code className="copy-value">{value}</code>
      <button type="button" className="btn small" onClick={onCopy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
