import { useEffect, useRef, useState } from "react";
import type { Entry } from "../../shared/types";
import { metricsLine, sourceLabel } from "../format";
import type { Store } from "../store";
import { CheckIcon, TrashIcon } from "./Icons";

interface Props {
  entry: Entry;
  store: Store;
  planTitle?: string;
  open: boolean;
  onOpen(open: boolean): void;
  showDate?: boolean;
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange(): void; label: string }) {
  return (
    <button
      type="button"
      className={`check ${checked ? "checked" : ""}`}
      aria-pressed={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
    >
      {checked && <CheckIcon size={14} />}
    </button>
  );
}

export function EntryRow({ entry, store, planTitle, open, onOpen }: Props) {
  const done = entry.status === "done";
  const agent = sourceLabel(entry.source);
  const meta = metricsLine(entry);
  const [justChecked, setJustChecked] = useState(false);

  const toggle = () => {
    if (!done) {
      setJustChecked(true);
      setTimeout(() => setJustChecked(false), 500);
    }
    store.update(entry.id, { status: done ? "planned" : "done" });
  };

  if (open) return <EntryEditor entry={entry} store={store} onClose={() => onOpen(false)} planTitle={planTitle} />;

  return (
    <div className={`row ${done ? "done" : ""} ${justChecked ? "pop" : ""}`} onClick={() => onOpen(true)}>
      <Checkbox checked={done} onChange={toggle} label={done ? "Mark as not done" : "Mark as done"} />
      <div className="row-body">
        <div className="row-title">{entry.exercise}</div>
        {(meta || entry.notes) && (
          <div className="row-meta">
            {meta}
            {meta && entry.notes ? " — " : ""}
            {entry.notes && <span className="row-notes">{entry.notes}</span>}
          </div>
        )}
      </div>
      <div className="row-tags">
        {planTitle && <span className="tag">{planTitle}</span>}
        {agent && <span className="tag tag-agent">{agent}</span>}
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = "1",
  width = 64,
}: {
  label: string;
  value: number | null;
  onChange(v: number | null): void;
  step?: string;
  width?: number;
}) {
  return (
    <label className="field" style={{ width }}>
      <span>{label}</span>
      <input
        inputMode="decimal"
        type="number"
        min="0"
        step={step}
        value={value ?? ""}
        placeholder="–"
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    </label>
  );
}

function EntryEditor({ entry, store, onClose, planTitle }: { entry: Entry; store: Store; onClose(): void; planTitle?: string }) {
  const [draft, setDraft] = useState(entry);
  const ref = useRef<HTMLDivElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const set = <K extends keyof Entry>(k: K, v: Entry[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const commit = () => {
    const d = draftRef.current;
    const changed: Partial<Entry> = {};
    (["exercise", "date", "sets", "reps", "weight", "unit", "duration_min", "distance", "distance_unit", "notes"] as const).forEach(
      (k) => {
        if (d[k] !== entry[k]) (changed as Record<string, unknown>)[k] = d[k];
      },
    );
    if (changed.weight != null && !d.unit) changed.unit = "lb";
    if (changed.distance != null && !d.distance_unit) changed.distance_unit = "mi";
    if (Object.keys(changed).length && d.exercise.trim()) store.update(entry.id, changed);
    onClose();
  };

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) commit();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && commit();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const done = draft.status === "done";

  return (
    <div className="card" ref={ref}>
      <div className="card-head">
        <Checkbox
          checked={done}
          onChange={() => {
            set("status", done ? "planned" : "done");
            store.update(entry.id, { status: done ? "planned" : "done" });
          }}
          label="Toggle done"
        />
        <input
          className="card-title"
          value={draft.exercise}
          autoFocus
          onChange={(e) => set("exercise", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          list="exercise-names"
          aria-label="Exercise"
        />
      </div>
      <textarea
        className="card-notes"
        placeholder="Notes"
        rows={1}
        value={draft.notes ?? ""}
        onChange={(e) => set("notes", e.target.value || null)}
      />
      <div className="card-fields">
        <NumField label="Sets" value={draft.sets} onChange={(v) => set("sets", v)} />
        <NumField label="Reps" value={draft.reps} onChange={(v) => set("reps", v)} />
        <NumField label="Weight" value={draft.weight} onChange={(v) => set("weight", v)} step="0.5" width={76} />
        <button type="button" className="unit" onClick={() => set("unit", draft.unit === "kg" ? "lb" : "kg")}>
          {draft.unit ?? "lb"}
        </button>
        <NumField label="Minutes" value={draft.duration_min} onChange={(v) => set("duration_min", v)} step="0.5" width={76} />
        <NumField label="Distance" value={draft.distance} onChange={(v) => set("distance", v)} step="0.1" width={76} />
        <button
          type="button"
          className="unit"
          onClick={() => set("distance_unit", draft.distance_unit === "km" ? "mi" : "km")}
        >
          {draft.distance_unit ?? "mi"}
        </button>
      </div>
      <div className="card-foot">
        <input type="date" className="date-pill" value={draft.date} onChange={(e) => e.target.value && set("date", e.target.value)} />
        {planTitle && <span className="tag">{planTitle}</span>}
        {sourceLabel(entry.source) && <span className="tag tag-agent">{sourceLabel(entry.source)}</span>}
        <span className="spacer" />
        <button
          type="button"
          className="icon-btn danger"
          aria-label="Delete"
          onClick={() => {
            store.remove(entry.id);
            onClose();
          }}
        >
          <TrashIcon size={18} />
        </button>
      </div>
    </div>
  );
}
