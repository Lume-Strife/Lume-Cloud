"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BulbShape } from "./BulbShape";

type Mood = "idle" | "happy" | "dizzy";

const ON_LINES = [
  "Lights on!",
  "Hi there!",
  "Ooh, bright.",
  "Back in business.",
  "Hello again.",
];
const OFF_LINES = ["Night night…", "Lights out.", "Five more minutes…"];
const DIZZY_LINES = ["Whoa, easy!", "I'm seeing stars…", "Okay okay, I'm up!"];
const STILL_DIZZY_LINES = ["Hey!", "Give me a sec…", "Stop spinning me!"];
const pick = (lines: string[]) =>
  lines[Math.floor(Math.random() * lines.length)];

/** The SVG viewBox (bulb coordinates plus room for the glow and the Zzz). */
const VIEW = { x: -6, y: -8, w: 112, h: 136 };
/** Eye centres in bulb coordinates. */
const EYES = [
  { cx: 40, cy: 49 },
  { cx: 60, cy: 49 },
];
/** Where the face sits, and how far it turns toward the pointer: the whole face moves
 *  a little, like a head turning, and the eyes glance a touch further. */
const FACE = { cx: 50, cy: 54 };
const TURN = { x: 3.2, y: 2.2 };
const GLANCE = 0.9;
/** Warm near-black for the face, so it sits in the glow instead of on top of it. */
const INK = "#3A1D08";

/**
 * Lume's mascot: a bulb whose eyes follow the pointer. Tap to switch it on or off.
 * It blinks, looks around when left alone, blushes when you hover, and gets dizzy
 * if you tap it too fast. Eyes move by direct DOM updates so tracking never re-renders.
 */
export function BulbBuddy() {
  const [lit, setLit] = useState(true);
  const [mood, setMood] = useState<Mood>("idle");
  const [blink, setBlink] = useState(false);
  const [hover, setHover] = useState(false);
  const [bump, setBump] = useState(0);
  const [line, setLine] = useState<{ text: string; id: number } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const faceRef = useRef<SVGGElement>(null);
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

  /** Turn the face toward a direction (ux, uy unit vector) by `amount` (0 to 1). */
  const turn = useCallback((ux: number, uy: number, amount: number) => {
    const face = faceRef.current;
    if (face)
      face.style.transform = `translate(${ux * TURN.x * amount}px, ${uy * TURN.y * amount}px)`;
    const g = `translate(${ux * GLANCE * amount}px, ${uy * GLANCE * amount}px)`;
    pupils.current.forEach((p) => p && (p.style.transform = g));
  }, []);

  const lookAt = useCallback(
    (x: number, y: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const box = svg.getBoundingClientRect();
      const scale = box.width / VIEW.w;
      const dx = x - (box.left + (FACE.cx - VIEW.x) * scale);
      const dy = y - (box.top + (FACE.cy - VIEW.y) * scale);
      const dist = Math.hypot(dx, dy) || 1;
      // Full turn once the pointer is about a bulb's width away.
      turn(dx / dist, dy / dist, Math.min(1, dist / box.width));
    },
    [turn],
  );

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
      turn(Math.cos(a), Math.sin(a), 0.4 + Math.random() * 0.6);
    }, 1700);
    return () => window.clearInterval(id);
  }, [turn]);

  // Blinks every few seconds while awake.
  useEffect(() => {
    if (!lit) return;
    let t: number;
    const schedule = () => {
      t = window.setTimeout(
        () => {
          setBlink(true);
          t = window.setTimeout(() => {
            setBlink(false);
            schedule();
          }, 140);
        },
        2200 + Math.random() * 3500,
      );
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
  const face =
    mood === "dizzy"
      ? "dizzy"
      : asleep
        ? "asleep"
        : mood === "happy"
          ? "happy"
          : "awake";

  return (
    <div className="bulb-buddy relative mx-auto flex w-full max-w-[230px] flex-col items-center select-none">
      <div aria-live="polite" className="h-10">
        {line && (
          <p
            key={line.id}
            className="bulb-speech rounded-xl border-2 border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm font-semibold shadow-[var(--shadow-btn)]"
          >
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
          <svg
            ref={svgRef}
            viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
            className="w-full overflow-visible"
            aria-hidden
          >
            <BulbShape id="buddy" />

            <g ref={faceRef} className="buddy-face">
              {/* Cheeks: a soft warm flush */}
              <g
                className={`buddy-cheeks ${(hover && !asleep) || face === "happy" ? "is-on" : ""}`}
                filter="url(#buddy-haze)"
              >
                <ellipse cx="30" cy="60" rx="5" ry="3" />
                <ellipse cx="70" cy="60" rx="5" ry="3" />
              </g>

              {/* Eyes: no outlines, just soft dark eyes with a catch-light */}
              {face === "awake" &&
                EYES.map((e, i) => (
                  <g key={i} ref={(el) => void (pupils.current[i] = el)}>
                    <g
                      className="buddy-eye"
                      style={{
                        transform: `scaleY(${blink ? 0.1 : 1}) scale(${hover ? 1.15 : 1})`,
                      }}
                    >
                      <ellipse
                        cx={e.cx}
                        cy={e.cy}
                        rx="3.7"
                        ry="4.7"
                        fill={INK}
                      />
                      <circle
                        cx={e.cx + 1.1}
                        cy={e.cy - 1.7}
                        r="1.15"
                        fill="#FFF8E6"
                      />
                    </g>
                  </g>
                ))}
              {face === "happy" &&
                EYES.map((e, i) => (
                  <path
                    key={i}
                    d={`M${e.cx - 4.2} ${e.cy + 1.5} Q${e.cx} ${e.cy - 4.5} ${e.cx + 4.2} ${e.cy + 1.5}`}
                    fill="none"
                    stroke={INK}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                ))}
              {face === "asleep" &&
                EYES.map((e, i) => (
                  <path
                    key={i}
                    d={`M${e.cx - 4.2} ${e.cy} Q${e.cx} ${e.cy + 3.4} ${e.cx + 4.2} ${e.cy}`}
                    fill="none"
                    stroke="var(--buddy-ink)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                ))}
              {face === "dizzy" &&
                EYES.map((e, i) => (
                  <path
                    key={i}
                    className="buddy-swirl"
                    style={{ transformOrigin: `${e.cx}px ${e.cy}px` }}
                    d={`M${e.cx} ${e.cy} m-1 0 a1 1 0 1 1 2 0 a2 2 0 1 1 -4 0 a3 3 0 1 1 6 0 a4 4 0 1 1 -8 0`}
                    fill="none"
                    stroke={INK}
                    strokeWidth="1.1"
                    strokeLinecap="round"
                  />
                ))}

              {/* Mouth */}
              {face === "happy" && (
                <path d="M44.5 61 Q50 68.5 55.5 61 Z" fill={INK} />
              )}
              {face === "awake" &&
                (hover ? (
                  <ellipse cx="50" cy="63.5" rx="2" ry="2.5" fill={INK} />
                ) : (
                  <path
                    d="M45.8 62 Q50 65.2 54.2 62"
                    fill="none"
                    stroke={INK}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                ))}
              {face === "asleep" && (
                <path
                  d="M47.8 63 Q50 64.3 52.2 63"
                  fill="none"
                  stroke="var(--buddy-ink)"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              )}
              {face === "dizzy" && (
                <path
                  d="M44 63 q1.5 -2 3 0 t3 0 t3 0 t3 0"
                  fill="none"
                  stroke={INK}
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              )}
            </g>

            {/* Zzz while asleep */}
            {face === "asleep" && (
              <g
                className="buddy-zzz"
                fill="var(--text-muted)"
                fontWeight="800"
                fontFamily="var(--font-display)"
              >
                <text x="80" y="18" fontSize="8">
                  z
                </text>
                <text x="86" y="9" fontSize="10">
                  z
                </text>
                <text x="93" y="-1" fontSize="12">
                  Z
                </text>
              </g>
            )}
          </svg>
        </span>
      </button>
    </div>
  );
}
