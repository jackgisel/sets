import { useMemo, useState } from "react";
import { parseWorkoutText } from "../../shared/parse";
import { addDays } from "../dates";
import { metricsLine } from "../format";
import type { Store } from "../store";

interface Props {
  store: Store;
  date: string;
  status: "done" | "planned";
  onDone(): void;
}

/** Things-style inline "new to-do" row. Parses as you type: "bench 3x10 135, 2 mile run". */
export function QuickAdd({ store, date, status, onDone }: Props) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const items = useMemo(() => parseWorkoutText(text), [text]);

  const save = async () => {
    if (!items.length || saving) return;
    setSaving(true);
    try {
      await store.add(
        items.map(({ day_offset, ...it }) => ({ ...it, date: addDays(date, day_offset ?? 0), status })),
        "manual",
      );
      setText("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card quick">
      <div className="card-head">
        <span className="check ghost" />
        <input
          className="card-title"
          autoFocus
          placeholder={status === "done" ? "What did you do?  e.g. bench 3x10 135" : "Plan something  e.g. 3 mile run"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") onDone();
          }}
          onBlur={() => !text && onDone()}
          list="exercise-names"
          aria-label="New workout"
        />
      </div>
      {items.length > 0 && (
        <div className="preview">
          {items.map((it, i) => (
            <div key={i} className="preview-item">
              <b>{it.exercise}</b>
              {metricsLine(it) && <span>{metricsLine(it)}</span>}
              {it.day_offset ? <span className="tag">yesterday</span> : null}
            </div>
          ))}
          <button type="button" className="btn primary small" onMouseDown={(e) => e.preventDefault()} onClick={save}>
            {saving ? "Adding…" : `Add ${items.length > 1 ? items.length : ""}`.trim()}
          </button>
        </div>
      )}
    </div>
  );
}
