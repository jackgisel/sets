import { useEffect, useRef, useState } from "react";
import { keepAwake, tick } from "../feedback";
import { Ring } from "./Ring";
import { CloseIcon } from "./Icons";

/**
 * Put the phone on the floor under your chest and touch it with your nose on every rep.
 * Space or Enter counts on a keyboard.
 */
export function Counter({
  remaining,
  color,
  onSave,
  onClose,
}: {
  remaining: number;
  color: string;
  onSave(reps: number): void;
  onClose(): void;
}) {
  const [count, setCount] = useState(0);
  const [bump, setBump] = useState(0);
  const countRef = useRef(0);
  countRef.current = count;
  const target = remaining > 0 ? remaining : 0;

  const add = (n: number) => {
    const next = Math.max(0, countRef.current + n);
    if (n > 0) {
      tick(target ? next / target : 0);
      setBump((b) => b + 1);
    }
    setCount(next);
  };

  useEffect(() => {
    let release = () => {};
    keepAwake().then((r) => (release = r));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        add(1);
      } else if (e.key === "Backspace") add(-1);
      else if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      release();
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, []);

  const hitGoal = target > 0 && count >= target;

  return (
    <div className={`counter ${hitGoal ? "hit" : ""}`} style={{ ["--ring" as string]: color }}>
      <div className="counter-top">
        <span className="counter-hint">{count === 0 ? "Phone under your chest. Touch it with your nose each rep." : target ? (hitGoal ? "Goal cleared. Keep going?" : `${target - count} to close the day`) : "Bonus reps"}</span>
        <button type="button" className="icon-btn" aria-label="Cancel" onClick={onClose}>
          <CloseIcon size={18} />
        </button>
      </div>
      <button
        type="button"
        className="counter-pad"
        aria-label="Count a rep"
        onPointerDown={(e) => {
          e.preventDefault();
          add(1);
        }}
      >
        <Ring value={target ? count / target : count > 0 ? 1 : 0} size={260} stroke={14} color={color}>
          <span key={bump} className="counter-num">
            {count}
          </span>
        </Ring>
      </button>
      <div className="counter-actions">
        <button type="button" className="btn" disabled={!count} onClick={() => add(-1)}>
          −1
        </button>
        <button type="button" className="btn primary" disabled={!count} onClick={() => onSave(count)}>
          Save {count || ""} {count === 1 ? "rep" : "reps"}
        </button>
      </div>
    </div>
  );
}
