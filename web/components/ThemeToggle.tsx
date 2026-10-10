"use client";

import { useSyncExternalStore } from "react";

import { THEME_EVENT, THEME_KEY, type Theme } from "@/lib/theme";

const subscribe = (cb: () => void) => {
  window.addEventListener(THEME_EVENT, cb);
  return () => window.removeEventListener(THEME_EVENT, cb);
};
const current = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

/** A light bulb: lit means light mode. Click it to turn the lights off. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  const lit = theme === "light";

  const toggle = () => {
    const next: Theme = lit ? "dark" : "light";
    if (next === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={lit ? "Switch to dark mode" : "Switch to light mode"}
      title={lit ? "Lights off" : "Lights on"}
      className={`theme-bulb ${lit ? "is-lit" : ""} flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[var(--border-default)] bg-[var(--bg-surface)] transition hover:border-[var(--border-strong)]`}
    >
      <svg viewBox="0 0 40 40" width="22" height="22" fill="none" aria-hidden>
        <circle className="theme-bulb-glow" cx="20" cy="15" r="14" />
        <path
          className="theme-bulb-glass"
          d="M20 4C14.477 4 10 8.477 10 14c0 3.63 1.874 6.817 4.708 8.68V26a1 1 0 001 1h8.584a1 1 0 001-1v-3.32C28.126 20.817 30 17.63 30 14c0-5.523-4.477-10-10-10z"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path className="theme-bulb-filament" d="M17 18.5l1.5-3 1.5 2 1.5-3 1.5 3" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        <rect className="theme-bulb-base" x="14.5" y="27" width="11" height="2.5" rx="0.5" strokeWidth="1.75" />
        <rect className="theme-bulb-base" x="15.5" y="30" width="9" height="2.5" rx="0.5" strokeWidth="1.75" />
        <rect className="theme-bulb-base" x="17" y="32.5" width="6" height="2" rx="1" strokeWidth="1.5" />
      </svg>
    </button>
  );
}
