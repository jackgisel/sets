import { useMemo, useState } from "react";
import { addDays, fmtDay, fromISO, today } from "../dates";

export interface DayStat {
  count: number;
  names: string[];
}

const level = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4);

export function Heatmap({ days, weeks = 53, showLegend = true }: { days: Map<string, DayStat>; weeks?: number; showLegend?: boolean }) {
  const t = today();
  const [selected, setSelected] = useState<string | null>(null);

  const { columns, months } = useMemo(() => {
    const end = addDays(t, 6 - fromISO(t).getDay());
    const start = addDays(end, -(weeks * 7 - 1));
    const cols: string[][] = [];
    const monthLabels: Array<{ col: number; label: string }> = [];
    let lastMonth = -1;
    for (let w = 0; w < weeks; w++) {
      const col: string[] = [];
      for (let d = 0; d < 7; d++) col.push(addDays(start, w * 7 + d));
      const m = fromISO(col[0]).getMonth();
      if (m !== lastMonth) {
        if (w < weeks - 1) monthLabels.push({ col: w, label: fromISO(col[0]).toLocaleDateString(undefined, { month: "short" }) });
        lastMonth = m;
      }
      cols.push(col);
    }
    return { columns: cols, months: monthLabels };
  }, [t, weeks]);

  const sel = selected ? days.get(selected) : undefined;

  return (
    <div className="heatmap">
      <div className="heatmap-scroll" ref={(el) => {
          if (el) el.scrollLeft = el.scrollWidth;
        }}>
        <div className="heatmap-grid" style={{ gridTemplateColumns: `22px repeat(${weeks}, var(--cell))` }}>
          <div />
          {columns.map((_, i) => {
            const m = months.find((x) => x.col === i);
            return (
              <div key={`m${i}`} className="heatmap-month">
                {m?.label ?? ""}
              </div>
            );
          })}
          {[0, 1, 2, 3, 4, 5, 6].map((dow) => (
            <HeatRow key={dow} dow={dow} columns={columns} days={days} t={t} selected={selected} onSelect={setSelected} />
          ))}
        </div>
      </div>
      <div className="heatmap-foot">
        <div className="heatmap-readout">
          {selected ? (
            <>
              <b>{fmtDay(selected, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</b>
              {" — "}
              {sel?.count ? `${sel.count} ${sel.count === 1 ? "exercise" : "exercises"}: ${sel.names.join(", ")}` : "Rest day"}
            </>
          ) : (
            <span className="muted">Tap a day for details</span>
          )}
        </div>
        {showLegend && (
          <div className="heatmap-legend">
            Less
            {[0, 1, 2, 3, 4].map((l) => (
              <span key={l} className={`cell l${l}`} />
            ))}
            More
          </div>
        )}
      </div>
    </div>
  );
}

function HeatRow({
  dow,
  columns,
  days,
  t,
  selected,
  onSelect,
}: {
  dow: number;
  columns: string[][];
  days: Map<string, DayStat>;
  t: string;
  selected: string | null;
  onSelect(d: string): void;
}) {
  return (
    <>
      <div className="heatmap-dow">{dow % 2 === 1 ? ["", "Mon", "", "Wed", "", "Fri", ""][dow] : ""}</div>
      {columns.map((col) => {
        const d = col[dow];
        if (d > t) return <div key={d} className="cell future" />;
        const n = days.get(d)?.count ?? 0;
        return (
          <button
            type="button"
            key={d}
            className={`cell l${level(n)} ${d === t ? "is-today" : ""} ${d === selected ? "is-selected" : ""}`}
            title={`${fmtDay(d)}: ${n || "no"} ${n === 1 ? "exercise" : "exercises"}`}
            onClick={() => onSelect(d)}
            aria-label={`${fmtDay(d)}: ${n} exercises`}
          />
        );
      })}
    </>
  );
}
