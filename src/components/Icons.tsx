import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = ({ size = 20, ...p }: P) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", ...p });

export const StarIcon = (p: P) => (
  <svg {...base(p)}>
    <path
      d="M12 2.8l2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.87l-5.5 2.88 1.05-6.12L3.1 9.3l6.15-.9L12 2.8z"
      fill="currentColor"
    />
  </svg>
);

export const CalendarIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4.5" width="18" height="16.5" rx="3.5" fill="currentColor" />
    <rect x="3" y="4.5" width="18" height="5" rx="2.5" fill="currentColor" opacity=".55" />
    <rect x="6.5" y="12" width="3" height="3" rx=".8" fill="#fff" />
    <rect x="10.5" y="12" width="3" height="3" rx=".8" fill="#fff" />
    <rect x="14.5" y="12" width="3" height="3" rx=".8" fill="#fff" />
    <rect x="6.5" y="16" width="3" height="3" rx=".8" fill="#fff" />
  </svg>
);

export const LogbookIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="4.5" fill="currentColor" />
    <path d="M7.5 12.3l3 3 6-6.3" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ChartIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="4.5" fill="currentColor" />
    <rect x="6.5" y="12.5" width="2.6" height="5" rx="1" fill="#fff" />
    <rect x="10.7" y="9" width="2.6" height="8.5" rx="1" fill="#fff" />
    <rect x="14.9" y="6.5" width="2.6" height="11" rx="1" fill="#fff" />
  </svg>
);

export const PlanIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" />
    <path d="M12 3a9 9 0 0 1 9 9h-9V3z" fill="currentColor" />
  </svg>
);

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
