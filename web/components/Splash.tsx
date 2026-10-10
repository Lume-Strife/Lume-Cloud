"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { SPLASH_KEY as KEY } from "@/lib/splash";

const noop = () => () => {};
const readSeen = () => {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * Dark bulb, the wordmark arrives, the bulb lights and the light fills the screen.
 * Plays once per tab session; any click or key skips it. Hidden entirely for reduced motion (see globals.css).
 */
export function Splash() {
  const seen = useSyncExternalStore(noop, readSeen, () => false);
  const [done, setDone] = useState(false);

  const finish = useCallback(() => {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {}
    setDone(true);
  }, []);

  useEffect(() => {
    if (seen || done) return;
    window.addEventListener("keydown", finish);
    return () => window.removeEventListener("keydown", finish);
  }, [seen, done, finish]);

  if (seen || done) return null;

  return (
    <div
      className="splash"
      aria-hidden
      onClick={finish}
      onAnimationEnd={(e) => e.target === e.currentTarget && finish()}
    >
      <div className="splash-mark">
        <span className="splash-word">
          {"Lume".split("").map((ch, i) => (
            <span key={i} style={{ animationDelay: `${0.25 + i * 0.09}s` }}>
              {ch}
            </span>
          ))}
        </span>
        <span className="splash-bulb">
          <span className="splash-glow" />
          <svg viewBox="0 0 40 40" fill="none">
            <path
              className="splash-glass"
              d="M20 4C14.477 4 10 8.477 10 14c0 3.63 1.874 6.817 4.708 8.68V26a1 1 0 001 1h8.584a1 1 0 001-1v-3.32C28.126 20.817 30 17.63 30 14c0-5.523-4.477-10-10-10z"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
            <path
              className="splash-filament"
              d="M17 18.5l1.5-3 1.5 2 1.5-3 1.5 3"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect className="splash-base" x="14.5" y="27" width="11" height="2.5" rx="0.5" strokeWidth="1.5" />
            <rect className="splash-base" x="15.5" y="30" width="9" height="2.5" rx="0.5" strokeWidth="1.5" />
            <rect className="splash-base" x="17" y="32.5" width="6" height="2" rx="1" strokeWidth="1.25" />
          </svg>
        </span>
      </div>
    </div>
  );
}
