"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { SPLASH_KEY as KEY } from "@/lib/splash";

import { BulbShape } from "./BulbShape";

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
          <svg viewBox="8 7 84 119" fill="none" overflow="visible">
            <BulbShape id="splash-bulb" glow={false} />
          </svg>
        </span>
      </div>
    </div>
  );
}
