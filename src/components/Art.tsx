import { useEffect, useRef, useState, type CSSProperties } from "react";

export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const paths: Record<string, React.ReactNode> = {
    arrow: (
      <>
        <path d="M7 17 17 7M7 7h10v10" />
      </>
    ),
    right: (
      <>
        <path d="M5 12h14m-5-5 5 5-5 5" />
      </>
    ),
    play: <path d="m9 5 10 7-10 7Z" />,
    pause: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V4H4v12h4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    wallet: (
      <>
        <path d="M20 8V5H4v15h16V8H4" />
        <path d="M20 11h-6v5h6m-3-2.5h.01" />
      </>
    ),
    heart: (
      <path d="M20.8 4.6a5.6 5.6 0 0 0-7.9 0l-.9.9-.9-.9a5.6 5.6 0 0 0-7.9 7.9L12 21l8.8-8.5a5.6 5.6 0 0 0 0-7.9Z" />
    ),
    wheel: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3" />
        <path d="m5.5 5.5 4.4 4.4m4.2 4.2 4.4 4.4M12 3v6m0 6v6m9-9h-6m-6 0H3m15.5-6.5-4.4 4.4m-4.2 4.2-4.4 4.4" />
      </>
    ),
    blocks: (
      <>
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
      </>
    ),
    activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
    calendar: (
      <>
        <rect x="4" y="5" width="16" height="16" rx="2" />
        <path d="M8 3v4m8-4v4M4 11h16m-11 4h1m4 0h1" />
      </>
    ),
    stake: (
      <>
        <ellipse cx="12" cy="6" rx="8" ry="3" />
        <path d="M4 6v6c0 4 16 4 16 0V6M4 12v6c0 4 16 4 16 0v-6" />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="8" cy="7" r="3" />
        <circle cx="16" cy="17" r="3" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    volume: (
      <>
        <path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
      </>
    ),
    screen: (
      <>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8m-4-4v4" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10v1" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M5 7a8 8 0 0 1 13-2l2 2M4 17l2 2a8 8 0 0 0 13-2" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    chevron: <path d="m9 5 7 7-7 7" />,
  };
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.blocks}
    </svg>
  );
}

export function Hamster({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 260 210"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M65 157c-23-19-29-4-23 6 4 7 15 10 29 7"
        stroke="#e5a929"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M85 183 67 196h29l14-17m50 3 15 14h25l-21-25"
        fill="#d99829"
        stroke="#15110b"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M60 153c-2-32 16-66 53-67 25 0 44 11 61 31 18 21 31 23 30 42-1 25-33 31-70 30-42 0-72-8-74-36Z"
        fill="#e6ac35"
        stroke="#15110b"
        strokeWidth="4"
      />
      <path
        d="M93 126c-13 20-12 44 3 55 12 9 48 9 70 5 25-4 37-13 35-28-1-14-16-17-30-30-23-20-61-25-78-2Z"
        fill="#f8df9c"
      />
      <path
        d="M154 118c-14-6-18-24-9-33 12-11 27-1 28 11m24 20c4-17 19-22 27-12 7 10-1 21-13 24"
        fill="#e6ac35"
        stroke="#15110b"
        strokeWidth="4"
      />
      <path
        d="M149 105c-6-4-7-12-1-14 6-3 12 3 12 8m46 17c4-9 12-12 13-5 1 4-3 8-8 9"
        fill="#cf8870"
      />
      <path
        d="M150 122c7-16 25-26 41-21 21 5 29 20 31 33 1 7 12 12 10 18-3 10-16 15-34 18-25 5-51-7-54-20-2-11 2-21 6-28Z"
        fill="#f2c568"
        stroke="#15110b"
        strokeWidth="4"
      />
      <path
        d="M167 143c6-8 15-8 22-1 8 7 11 7 18 3 13-8 21-2 22 7-6 10-20 15-35 15-21 0-35-10-27-24Z"
        fill="#f8e9bc"
      />
      <ellipse cx="197" cy="128" rx="5" ry="7" fill="#15110b" />
      <circle cx="198" cy="126" r="1.7" fill="#fff" />
      <path d="m227 142 8 2-7 6" fill="#9f6250" />
      <path
        d="m218 153 8-1m-5 6 7-5"
        stroke="#15110b"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="m227 148 19-6m-18 10h22m-22 4 16 7"
        stroke="#aa7b3c"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="m143 167 21 13 19-5"
        stroke="#15110b"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="m158 179 8 6 20-5"
        stroke="#e1a64b"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M82 130c1-9 9-19 16-22m10-5 7-1"
        stroke="#f6d47a"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wheel({
  progress,
  settlement,
}: {
  progress: number;
  settlement?: string;
}) {
  const safe = Math.max(0, Math.min(100, progress));
  const previousSettlement = useRef(settlement);
  const [animating, setAnimating] = useState(false);
  useEffect(() => {
    const previous = previousSettlement.current;
    previousSettlement.current = settlement;
    if (!previous || !settlement || previous === settlement) return;
    setAnimating(true);
    const timer = setTimeout(() => setAnimating(false), 700);
    return () => clearTimeout(timer);
  }, [settlement]);
  return (
    <div className="wheel-art" style={{ "--progress": safe } as CSSProperties}>
      <svg className="wheel-ring" viewBox="0 0 320 320" aria-hidden="true">
        <circle
          cx="160"
          cy="160"
          r="148"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
        />
        {Array.from({ length: 48 }, (_, i) => (
          <path
            key={i}
            d={i % 4 === 0 ? "M160 20v9" : "M160 20v4"}
            transform={`rotate(${i * 7.5} 160 160)`}
            stroke={i < safe * 0.48 ? "var(--accent)" : "#45454f"}
            strokeWidth={i % 4 === 0 ? 2 : 1}
          />
        ))}
        <circle
          cx="160"
          cy="160"
          r="119"
          fill="none"
          stroke="#26262f"
          strokeWidth="3"
        />
        <circle
          className="progress-ring"
          cx="160"
          cy="160"
          r="119"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeDasharray={`${safe * 7.477} 747.7`}
          transform="rotate(-90 160 160)"
          strokeLinecap="round"
        />
        <circle
          cx="160"
          cy="160"
          r="108"
          fill="none"
          stroke="#26262f"
          strokeDasharray="2 8"
        />
        <path
          d="M92 232c42 29 94 29 136 0"
          stroke="#7a642a"
          strokeWidth="2"
          fill="none"
        />
      </svg>
      <div
        key={settlement}
        className={`hamster-run${animating ? " settlement-pulse" : ""}`}
      >
        <Hamster />
      </div>
      <div className="wheel-caption">
        <span className="wheel-percent">
          {safe.toFixed(1)}
          <small>%</small>
        </span>
        <span className="mono muted">of next block</span>
      </div>
    </div>
  );
}
