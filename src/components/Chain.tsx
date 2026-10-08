import { useState, type ReactNode } from "react";
import { fmtDay } from "../dates";
import type { DayStatus } from "../pushups";
import { ShieldIcon } from "./Icons";

export interface ChainDay {
  date: string;
  status: DayStatus;
  /** How far an open day has come, 0–1. */
  pct?: number;
  /** Extra emphasis for a bonus day (e.g. 15k or 20k steps). */
  bonus?: number;
}

const DOW = ["M", "", "W", "", "F", "", "S"];

/** One link per day, Monday-first columns, newest on the right. */
export function Chain<T extends ChainDay>({
  weeks,
  today,
  color,
  describe,
  summary,
}: {
  weeks: Array<Array<T | null>>;
  today: string;
  color: string;
  describe(day: T): string;
  summary: ReactNode;
}) {
  const [sel, setSel] = useState<T | null>(null);
  return (
    <div style={{ ["--ring" as string]: color }}>
      <div className="heatmap-scroll" ref={(el) => void (el && (el.scrollLeft = el.scrollWidth))}>
        <div className="chain" style={{ gridTemplateColumns: `16px repeat(${weeks.length}, var(--cell))` }}>
          {DOW.map((label, dow) => (
            <ChainRow<T> key={dow} label={label} cells={weeks.map((w) => w[dow])} today={today} sel={sel} onSel={setSel} describe={describe} />
          ))}
        </div>
      </div>
      <div className="heatmap-foot">
        <div className="heatmap-readout">
          {sel ? (
            <>
              <b>{fmtDay(sel.date)}</b> — {describe(sel)}
            </>
          ) : (
            <span className="muted">{summary}</span>
          )}
        </div>
        <div className="heatmap-legend">
          <span className="link c-closed" /> closed
          <span className="link c-shielded">
            <ShieldIcon size={8} />
          </span>{" "}
          shielded
          <span className="link c-missed" /> missed
        </div>
      </div>
    </div>
  );
}

function ChainRow<T extends ChainDay>({
  label,
  cells,
  today,
  sel,
  onSel,
  describe,
}: {
  label: string;
  cells: Array<T | null>;
  today: string;
  sel: T | null;
  onSel(d: T): void;
  describe(d: T): string;
}) {
  return (
    <>
      <div className="heatmap-dow">{label}</div>
      {cells.map((d, i) =>
        !d ? (
          <span key={i} className="link c-future" />
        ) : (
          <button
            type="button"
            key={d.date}
            className={`link c-${d.status} ${d.bonus ? `bonus-${d.bonus}` : ""} ${d.date === today ? "is-today" : ""} ${sel?.date === d.date ? "is-selected" : ""}`}
            style={d.status === "open" ? { ["--p" as string]: `${Math.round(Math.min(d.pct ?? 0, 1) * 100)}%` } : undefined}
            onClick={() => onSel(d)}
            aria-label={`${fmtDay(d.date)}: ${describe(d)}`}
          >
            {d.status === "shielded" && <ShieldIcon size={8} />}
          </button>
        ),
      )}
    </>
  );
}
