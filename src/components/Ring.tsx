import type { ReactNode } from "react";

/** An activity ring. Past 100% it keeps going as a brighter second lap. */
export function Ring({
  value,
  size = 120,
  stroke = 10,
  color,
  children,
  className = "",
}: {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  children?: ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const first = Math.min(Math.max(value, 0), 1);
  const lap = Math.min(Math.max(value - 1, 0), 1);
  return (
    <div className={`ring ${value >= 1 ? "is-closed" : ""} ${className}`} style={{ width: size, height: size, ["--ring" as string]: color }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ring-fill"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - first)}
        />
        {lap > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            className="ring-lap"
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={c * (1 - lap)}
          />
        )}
      </svg>
      {children && <div className="ring-center">{children}</div>}
    </div>
  );
}
