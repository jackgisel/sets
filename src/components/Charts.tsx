import { useLayoutEffect, useRef, useState } from "react";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export interface Point {
  label: string;
  value: number;
  tip?: string;
}

const PAD = { top: 16, right: 8, bottom: 22, left: 8 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

export function BarChart({
  data,
  height = 150,
  color = "var(--blue)",
  format = String,
  labelEvery = 1,
}: {
  data: Point[];
  height?: number;
  color?: string;
  format?: (n: number) => string;
  labelEvery?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const slot = data.length ? innerW / data.length : 0;
  const bw = Math.max(4, Math.min(28, slot * 0.62));
  const active = hover ?? data.length - 1;

  return (
    <div ref={ref} className="chart">
      {width > 0 && (
        <svg width={width} height={height} onMouseLeave={() => setHover(null)}>
          {[0.5, 1].map((f) => (
            <line key={f} x1={PAD.left} x2={width - PAD.right} y1={PAD.top + innerH * (1 - f)} y2={PAD.top + innerH * (1 - f)} className="gridline" />
          ))}
          {data.map((d, i) => {
            const h = (d.value / max) * innerH;
            const x = PAD.left + slot * i + (slot - bw) / 2;
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
                <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH} fill="transparent" />
                <rect
                  x={x}
                  y={PAD.top + innerH - Math.max(h, d.value > 0 ? 3 : 0)}
                  width={bw}
                  height={Math.max(h, d.value > 0 ? 3 : 0)}
                  rx={Math.min(5, bw / 2)}
                  fill={color}
                  opacity={i === active ? 1 : 0.45}
                />
                {d.value === 0 && <rect x={x} y={PAD.top + innerH - 2} width={bw} height={2} rx={1} className="zero-bar" />}
                {(i % labelEvery === 0 || i === data.length - 1) && (
                  <text x={PAD.left + slot * i + slot / 2} y={height - 6} className="axis-label" textAnchor="middle">
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {data[active] && (
        <div className="chart-readout">
          <b>{format(data[active].value)}</b> <span className="muted">{data[active].tip ?? data[active].label}</span>
        </div>
      )}
    </div>
  );
}

export function LineChart({
  data,
  height = 170,
  color = "var(--blue)",
  format = String,
}: {
  data: Point[];
  height?: number;
  color?: string;
  format?: (n: number) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return <div className="chart empty muted">No data yet</div>;

  const values = data.map((d) => d.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || Math.max(1, hi * 0.2);
  const min = Math.max(0, lo - span * 0.25);
  const max = hi + span * 0.25;
  const pad = { ...PAD, left: 12, right: 12 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (data.length === 1 ? innerW / 2 : (innerW * i) / (data.length - 1));
  const y = (v: number) => pad.top + innerH - ((v - min) / (max - min)) * innerH;
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join("");
  const area = `${path}L${x(data.length - 1)},${pad.top + innerH}L${x(0)},${pad.top + innerH}Z`;
  const bestIdx = values.lastIndexOf(hi);
  const active = hover ?? data.length - 1;
  const gid = `g${color.replace(/[^a-z0-9]/gi, "")}`;

  const onMove = (clientX: number, rect: DOMRect) => {
    const rel = clientX - rect.left - pad.left;
    const i = data.length === 1 ? 0 : Math.round((rel / innerW) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <div ref={ref} className="chart">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          onMouseMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
          onTouchMove={(e) => onMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1={pad.left} x2={width - pad.right} y1={y(hi)} y2={y(hi)} className="gridline dashed" />
          <path d={area} fill={`url(#${gid})`} />
          <path d={path} fill="none" stroke={color} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) =>
            data.length <= 40 || i === active || i === bestIdx ? (
              <circle key={i} cx={x(i)} cy={y(d.value)} r={i === active ? 5 : 3} fill="#fff" stroke={color} strokeWidth={2} />
            ) : null,
          )}
          <line x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + innerH} className="gridline" />
          <text x={x(bestIdx)} y={y(hi) - 8} className="pr-label" textAnchor={bestIdx > data.length * 0.8 ? "end" : "middle"}>
            PR {format(hi)}
          </text>
          <text x={pad.left} y={height - 6} className="axis-label">
            {data[0].label}
          </text>
          <text x={width - pad.right} y={height - 6} className="axis-label" textAnchor="end">
            {data[data.length - 1].label}
          </text>
        </svg>
      )}
      <div className="chart-readout">
        <b>{format(data[active].value)}</b> <span className="muted">{data[active].tip ?? data[active].label}</span>
      </div>
    </div>
  );
}
