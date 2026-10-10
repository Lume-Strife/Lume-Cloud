"use client";

import { useSyncExternalStore } from "react";

import { THEME_EVENT, THEME_KEY, type Theme } from "@/lib/theme";

import { BulbShape } from "./BulbShape";

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
      <svg viewBox="0 1 100 125" width="21" height="26" fill="none" aria-hidden>
        <BulbShape id="toggle-bulb" glow={false} small />
      </svg>
    </button>
  );
}
