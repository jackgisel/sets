import { useEffect, useRef, useState } from "react";
import type { ParsedItem } from "../../shared/types";
import { api } from "../api";
import { startRecording, type Recorder } from "../audio";
import { addDays, today } from "../dates";
import { metricsLine } from "../format";
import type { Store } from "../store";
import { Checkbox } from "./EntryRow";
import { CloseIcon, MicIcon } from "./Icons";

type Phase = "recording" | "working" | "review" | "error";

const MAX_SECONDS = 120;

export function VoiceSheet({ store, onClose }: { store: Store; onClose(): void }) {
  const [phase, setPhase] = useState<Phase>("recording");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [keep, setKeep] = useState<boolean[]>([]);
  const [saving, setSaving] = useState(false);
  const rec = useRef<Recorder | null>(null);
  const bars = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    const started = Date.now();
    startRecording()
      .then((r) => {
        if (cancelled) return r.cancel();
        rec.current = r;
        const tick = () => {
          const lvl = r.level();
          bars.current?.style.setProperty("--lvl", String(lvl));
          const s = Math.floor((Date.now() - started) / 1000);
          setSeconds(s);
          if (s >= MAX_SECONDS) finish();
          else raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch((err) => {
        setPhase("error");
        setError(
          err?.name === "NotAllowedError"
            ? "Microphone access was blocked. Allow it in your browser settings and try again."
            : "Couldn't start the microphone on this device.",
        );
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      rec.current?.cancel();
    };
  }, []);

  const applyResult = (text: string, parsed: ParsedItem[]) => {
    setTranscript(text);
    setItems(parsed);
    setKeep(parsed.map(() => true));
    setPhase("review");
  };

  async function finish() {
    const r = rec.current;
    if (!r) return;
    rec.current = null;
    setPhase("working");
    try {
      const audio = await r.stop();
      const res = await api.transcribe(audio);
      applyResult(res.text, res.items);
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const reparse = async () => {
    setPhase("working");
    try {
      const res = await api.parse(transcript);
      applyResult(res.text, res.items);
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const save = async () => {
    const t = today();
    const chosen = items.filter((_, i) => keep[i]);
    if (!chosen.length) return onClose();
    setSaving(true);
    try {
      await store.add(
        chosen.map(({ day_offset, ...it }) => ({ ...it, date: addDays(t, day_offset ?? 0), status: "done" as const })),
        "voice",
      );
      onClose();
    } catch {
      setSaving(false);
    }
  };

  const count = keep.filter(Boolean).length;

  return (
    <div className="sheet-backdrop" onClick={() => phase !== "working" && onClose()}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Voice log">
        <button type="button" className="icon-btn sheet-close" onClick={onClose} aria-label="Close">
          <CloseIcon size={18} />
        </button>

        {phase === "recording" && (
          <div className="voice">
            <p className="voice-hint">Say what you did</p>
            <p className="voice-example">“3 sets of 10 bench at 135, then a 2 mile run”</p>
            <div className="voice-orb" ref={bars}>
              <MicIcon size={34} />
            </div>
            <div className="voice-time">
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
            </div>
            <button type="button" className="btn primary wide" onClick={finish} disabled={!rec.current && seconds === 0}>
              Done
            </button>
          </div>
        )}

        {phase === "working" && (
          <div className="voice">
            <div className="spinner" />
            <p className="voice-hint">Transcribing…</p>
          </div>
        )}

        {phase === "error" && (
          <div className="voice">
            <p className="voice-hint">Hmm.</p>
            <p className="muted center">{error}</p>
            <button type="button" className="btn wide" onClick={onClose}>
              Close
            </button>
          </div>
        )}

        {phase === "review" && (
          <div className="review">
            <h3>Add to Today</h3>
            <textarea
              className="transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={2}
              aria-label="Transcript"
            />
            <button type="button" className="link-btn" onClick={reparse}>
              Re-read transcript
            </button>
            {items.length === 0 && <p className="muted">I didn't catch any exercises. Edit the text above and re-read it.</p>}
            <div className="list">
              {items.map((it, i) => (
                <div key={i} className={`row ${keep[i] ? "" : "excluded"}`} onClick={() => setKeep((k) => k.map((v, j) => (j === i ? !v : v)))}>
                  <Checkbox checked={keep[i]} onChange={() => setKeep((k) => k.map((v, j) => (j === i ? !v : v)))} label="Include" />
                  <div className="row-body">
                    <div className="row-title">{it.exercise}</div>
                    <div className="row-meta">
                      {metricsLine(it)}
                      {it.day_offset ? " · yesterday" : ""}
                      {it.notes ? ` — ${it.notes}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="btn primary wide" onClick={save} disabled={saving || count === 0}>
              {saving ? "Adding…" : count ? `Add ${count} ${count === 1 ? "exercise" : "exercises"}` : "Nothing selected"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
