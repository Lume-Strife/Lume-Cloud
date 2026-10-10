/**
 * Sign-in backdrop: a city at dusk (night in dark mode) on the grid, with power lines
 * and lit windows. Drawn rather than photographed so it stays sharp, light and on-theme.
 * Colours come from --scene-* tokens in globals.css.
 */

// Deterministic so the server and client draw the same skyline.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Building = { x: number; w: number; h: number };
type Win = { x: number; y: number; flicker: boolean };

const W = 1440;
const H = 900;

function skyline(seed: number, minH: number, maxH: number, minW: number, maxW: number): Building[] {
  const r = rng(seed);
  const out: Building[] = [];
  for (let x = -20; x < W + 20; ) {
    const w = Math.round(minW + r() * (maxW - minW));
    out.push({ x, w, h: Math.round(minH + r() * (maxH - minH)) });
    x += w + Math.round(r() * 6);
  }
  return out;
}

function windows(buildings: Building[], seed: number, chance: number): Win[] {
  const r = rng(seed);
  const out: Win[] = [];
  for (const b of buildings) {
    for (let y = H - b.h + 16; y < H - 24; y += 20) {
      for (let x = b.x + 10; x < b.x + b.w - 14; x += 16) {
        if (r() < chance) out.push({ x, y, flicker: r() < 0.08 });
      }
    }
  }
  return out;
}

const FAR = skyline(7, 220, 430, 50, 120);
const NEAR = skyline(42, 110, 270, 70, 150);
const FAR_WIN = windows(FAR, 11, 0.12);
const NEAR_WIN = windows(NEAR, 19, 0.2);
const POLES = [150, 720, 1290];
const POLE_TOP = 430;

/** Sagging wire between two poles, as a quadratic curve. */
const wire = (x1: number, x2: number, y: number, sag: number) =>
  `M${x1} ${y} Q${(x1 + x2) / 2} ${y + sag} ${x2} ${y}`;

export function GridScene() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="scene-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--scene-sky-top)" />
          <stop offset="1" stopColor="var(--scene-sky-bottom)" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#scene-sky)" />

      {FAR.map((b, i) => (
        <rect key={i} x={b.x} y={H - b.h} width={b.w} height={b.h} fill="var(--scene-far)" />
      ))}
      {FAR_WIN.map((w, i) => (
        <rect key={i} x={w.x} y={w.y} width={6} height={9} rx={1} fill="var(--scene-window)" opacity={0.45} />
      ))}

      {/* Power lines run behind the near buildings. */}
      {POLES.slice(0, -1).map((x, i) =>
        [0, 14, 28].map((dy) => (
          <path
            key={`${i}-${dy}`}
            d={wire(x, POLES[i + 1], POLE_TOP + 8 + dy, 60 + dy)}
            fill="none"
            stroke="var(--scene-wire)"
            strokeWidth={2}
          />
        )),
      )}
      {POLES.map((x) => (
        <g key={x} fill="var(--scene-pole)">
          <rect x={x - 5} y={POLE_TOP} width={10} height={H - POLE_TOP} />
          <rect x={x - 46} y={POLE_TOP + 4} width={92} height={7} rx={2} />
          <rect x={x - 32} y={POLE_TOP + 20} width={64} height={6} rx={2} />
        </g>
      ))}

      {NEAR.map((b, i) => (
        <rect key={i} x={b.x} y={H - b.h} width={b.w} height={b.h} fill="var(--scene-near)" />
      ))}
      {NEAR_WIN.map((w, i) => (
        <rect
          key={i}
          className={w.flicker ? "scene-flicker" : undefined}
          style={w.flicker ? { animationDelay: `${(i % 7) * 1.3}s` } : undefined}
          x={w.x}
          y={w.y}
          width={7}
          height={10}
          rx={1}
          fill="var(--scene-window)"
        />
      ))}
    </svg>
  );
}
