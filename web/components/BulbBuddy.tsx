"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Mood = "idle" | "happy" | "dizzy";

const ON_LINES = ["Lights on!", "Hi there!", "Ooh, bright.", "Back in business.", "Hello again."];
const OFF_LINES = ["Night night…", "Lights out.", "Five more minutes…"];
const DIZZY_LINES = ["Whoa, easy!", "I'm seeing stars…", "Okay okay, I'm up!"];
const STILL_DIZZY_LINES = ["Hey!", "Give me a sec…", "Stop spinning me!"];
const pick = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];

/** Eye centres in the SVG's own coordinates, and how far a pupil may travel. */
const EYES = [
  { cx: 88, cy: 84 },
  { cx: 132, cy: 84 },
];
const REACH = 6;

/**
 * Lume's mascot: a bulb whose eyes follow the pointer. Tap to switch it on or off.
 * It blinks, looks around when left alone, blushes when you hover, and gets dizzy
 * if you tap it too fast. Pupils move by direct DOM updates so tracking never re-renders.
 */
export function BulbBuddy() {
  const [lit, setLit] = useState(true);
  const [mood, setMood] = useState<Mood>("idle");
  const [blink, setBlink] = useState(false);
  const [hover, setHover] = useState(false);
  const [bump, setBump] = useState(0);
  const [line, setLine] = useState<{ text: string; id: number } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const pupils = useRef<(SVGGElement | null)[]>([]);
  const lastMove = useRef(0);
  const taps = useRef<number[]>([]);
  const dizzyUntil = useRef(0);
  const timers = useRef<number[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const say = useCallback(
    (text: string) => {
      const id = Date.now();
      setLine({ text, id });
      later(() => setLine((l) => (l?.id === id ? null : l)), 1800);
    },
    [later],
  );

  const lookAt = useCallback((x: number, y: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const scale = box.width / 220;
    EYES.forEach((eye, i) => {
      const ex = box.left + eye.cx * scale;
      const ey = box.top + eye.cy * scale;
      const dx = x - ex;
      const dy = y - ey;
      const dist = Math.hypot(dx, dy) || 1;
      const travel = Math.min(REACH, dist / 25);
      pupils.current[i]?.setAttribute("transform", `translate(${(dx / dist) * travel} ${(dy / dist) * travel})`);
    });
  }, []);

  // Follow the pointer (mouse, pen or finger) anywhere on the page.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      lastMove.current = Date.now();
      lookAt(e.clientX, e.clientY);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
    };
  }, [lookAt]);

  // Left alone for a while, it looks around by itself.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (Date.now() - lastMove.current < 4000) return;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * REACH;
      pupils.current.forEach((p) => p?.setAttribute("transform", `translate(${Math.cos(a) * r} ${Math.sin(a) * r})`));
    }, 1700);
    return () => window.clearInterval(id);
  }, []);

  // Blinks every few seconds while awake.
  useEffect(() => {
    if (!lit) return;
    let t: number;
    const schedule = () => {
      t = window.setTimeout(() => {
        setBlink(true);
        t = window.setTimeout(() => {
          setBlink(false);
          schedule();
        }, 140);
      }, 2200 + Math.random() * 3500);
    };
    schedule();
    return () => window.clearTimeout(t);
  }, [lit]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const tap = () => {
    const now = Date.now();
    setBump((b) => b + 1);

    // Still dizzy: it won't switch, it just complains.
    if (now < dizzyUntil.current) {
      say(pick(STILL_DIZZY_LINES));
      return;
    }
    taps.current = [...taps.current.filter((t) => now - t < 2000), now];

    if (taps.current.length >= 4) {
      taps.current = [];
      setLit(true);
      setMood("dizzy");
      dizzyUntil.current = now + 1900;
      say(pick(DIZZY_LINES));
      later(() => setMood("idle"), 1900);
      return;
    }

    const next = !lit;
    setLit(next);
    if (next) {
      setMood("happy");
      say(pick(ON_LINES));
      later(() => setMood((m) => (m === "happy" ? "idle" : m)), 1100);
    } else {
      setMood("idle");
      say(pick(OFF_LINES));
    }
  };

  const asleep = !lit && mood !== "dizzy";
  const face = mood === "dizzy" ? "dizzy" : asleep ? "asleep" : mood === "happy" ? "happy" : "awake";

  return (
    <div className="bulb-buddy relative mx-auto flex w-full max-w-[280px] flex-col items-center select-none">
      <div aria-live="polite" className="h-10">
        {line && (
          <p key={line.id} className="bulb-speech rounded-xl border-2 border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm font-semibold shadow-[var(--shadow-btn)]">
            {line.text}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={tap}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        aria-pressed={lit}
        aria-label={`Lume the bulb. Tap to switch it ${lit ? "off" : "on"}.`}
        className={`bulb-body relative w-full cursor-pointer rounded-full ${lit ? "is-lit" : ""} ${mood === "dizzy" ? "is-dizzy" : ""}`}
      >
        <span key={bump} className={bump ? "bulb-bounce block" : "block"}>
          <svg ref={svgRef} viewBox="0 0 220 260" className="w-full overflow-visible" aria-hidden>
            <defs>
              <radialGradient id="buddy-glow">
                <stop offset="0" stopColor="#FDE68A" stopOpacity="0.95" />
                <stop offset="0.45" stopColor="#FBBF24" stopOpacity="0.35" />
                <stop offset="1" stopColor="#FBBF24" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="buddy-glass-lit" cx="0.4" cy="0.3" r="0.8">
                <stop offset="0" stopColor="#FFF7D6" />
                <stop offset="0.55" stopColor="#FDE68A" />
                <stop offset="1" stopColor="#FBBF24" />
              </radialGradient>
            </defs>

            <circle className="buddy-glow" cx="110" cy="92" r="125" fill="url(#buddy-glow)" />

            {/* The brand bulb, scaled up. */}
            <g transform="translate(-30 -18) scale(7)">
              <path
                className="buddy-glass"
                d="M20 4C14.477 4 10 8.477 10 14c0 3.63 1.874 6.817 4.708 8.68V26a1 1 0 001 1h8.584a1 1 0 001-1v-3.32C28.126 20.817 30 17.63 30 14c0-5.523-4.477-10-10-10z"
                strokeWidth="3.5"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
              <path d="M15 12c0-2.21 1.79-4 4-4" stroke="white" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" opacity="0.7" />
              {[
                [14.5, 27, 11, 2.5],
                [15.5, 30, 9, 2.5],
                [17, 32.5, 6, 2],
              ].map(([x, y, w, h]) => (
                <rect key={y} className="buddy-base" x={x} y={y} width={w} height={h} rx={0.6} strokeWidth="3" vectorEffect="non-scaling-stroke" />
              ))}
            </g>

            {/* Cheeks */}
            <g className={`buddy-cheeks ${(hover && !asleep) || face === "happy" ? "is-on" : ""}`}>
              <ellipse cx="70" cy="106" rx="9" ry="5" />
              <ellipse cx="150" cy="106" rx="9" ry="5" />
            </g>

            {/* Eyes */}
            {face === "awake" &&
              EYES.map((e, i) => (
                <g
                  key={i}
                  className="buddy-eye"
                  style={{ transform: `scaleY(${blink ? 0.08 : 1}) scale(${hover ? 1.12 : 1})` }}
                >
                  <ellipse cx={e.cx} cy={e.cy} rx="13" ry="15" fill="white" stroke="#1A1E29" strokeWidth="3" />
                  <g ref={(el) => void (pupils.current[i] = el)}>
                    <circle cx={e.cx} cy={e.cy + 1} r="6.5" fill="#1A1E29" />
                    <circle cx={e.cx + 2.5} cy={e.cy - 2} r="2" fill="white" />
                  </g>
                </g>
              ))}
            {face === "happy" &&
              EYES.map((e, i) => (
                <path key={i} d={`M${e.cx - 11} ${e.cy + 4} Q${e.cx} ${e.cy - 12} ${e.cx + 11} ${e.cy + 4}`} fill="none" stroke="#1A1E29" strokeWidth="4" strokeLinecap="round" />
              ))}
            {face === "asleep" &&
              EYES.map((e, i) => (
                <path key={i} d={`M${e.cx - 11} ${e.cy} Q${e.cx} ${e.cy + 8} ${e.cx + 11} ${e.cy}`} fill="none" stroke="var(--buddy-ink)" strokeWidth="4" strokeLinecap="round" />
              ))}
            {face === "dizzy" &&
              EYES.map((e, i) => (
                <path
                  key={i}
                  className="buddy-swirl"
                  style={{ transformOrigin: `${e.cx}px ${e.cy}px` }}
                  d={`M${e.cx} ${e.cy} m-2 0 a2 2 0 1 1 4 0 a4 4 0 1 1 -8 0 a6 6 0 1 1 12 0 a8 8 0 1 1 -16 0`}
                  fill="none"
                  stroke="#1A1E29"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              ))}

            {/* Mouth */}
            {face === "happy" && <path d="M96 114 Q110 134 124 114 Z" fill="#1A1E29" />}
            {face === "awake" && (hover ? <ellipse cx="110" cy="120" rx="5" ry="6" fill="#1A1E29" /> : <path d="M99 117 Q110 126 121 117" fill="none" stroke="#1A1E29" strokeWidth="3.5" strokeLinecap="round" />)}
            {face === "asleep" && <path d="M104 121 Q110 124 116 121" fill="none" stroke="var(--buddy-ink)" strokeWidth="3" strokeLinecap="round" />}
            {face === "dizzy" && <path d="M95 121 q4 -5 7.5 0 t7.5 0 t7.5 0 t7.5 0" fill="none" stroke="#1A1E29" strokeWidth="3" strokeLinecap="round" />}

            {/* Zzz while asleep */}
            {face === "asleep" && (
              <g className="buddy-zzz" fill="var(--text-muted)" fontWeight="800" fontFamily="var(--font-display)">
                <text x="160" y="40" fontSize="16">z</text>
                <text x="172" y="26" fontSize="20">z</text>
                <text x="188" y="10" fontSize="24">Z</text>
              </g>
            )}
          </svg>
        </span>
      </button>

      <p className="mt-3 text-xs text-[var(--text-muted)]">{lit ? "Tap to switch me off" : "Tap to wake me up"}</p>
    </div>
  );
}
