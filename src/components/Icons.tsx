import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = ({ size = 20, ...p }: P) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", ...p });

export const PlusIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

export const MicIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="8.5" y="3" width="7" height="12" rx="3.5" fill="currentColor" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const CheckIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 12.5l4 4 8-9" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const TrashIcon = (p: P) => (
  <svg {...base(p)}>
    <path
      d="M4.5 6.5h15M9.5 6.5V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7M6.5 6.5l.8 12.2c.1 1 .9 1.8 1.9 1.8h5.6c1 0 1.8-.8 1.9-1.8l.8-12.2"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CloseIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export const FlameIcon = (p: P) => (
  <svg {...base(p)}>
    <path
      d="M12 2.5c.6 3.2 4.8 5.4 4.8 10.3A4.8 4.8 0 0 1 12 21.5a5 5 0 0 1-5-5c0-2.4 1.4-3.6 2.3-5 .2 1.4.9 2.4 1.9 2.8-.4-3.6.4-7.3.8-11.8z"
      fill="currentColor"
    />
  </svg>
);

export const ShieldIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 2.8l7.5 2.9v5.6c0 4.8-3.1 8.4-7.5 9.9-4.4-1.5-7.5-5.1-7.5-9.9V5.7L12 2.8z" fill="currentColor" />
  </svg>
);

export const RingIcon = (p: P & { pct?: number }) => {
  const { pct = 0, ...rest } = p;
  const c = 2 * Math.PI * 8;
  return (
    <svg {...base(rest)}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeOpacity=".25" strokeWidth="3.2" />
      {pct > 0 && <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, Math.max(0, pct)))}
        transform="rotate(-90 12 12)"
      />}
    </svg>
  );
};
