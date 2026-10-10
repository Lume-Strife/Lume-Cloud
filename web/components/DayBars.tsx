"use client";

import { useState } from "react";

import { DAY_STATUS_LABEL, hours, kwh, shortDate } from "@/lib/format";
import type { DayStatus } from "@/lib/types";

type Day = { date: string; value: number; status?: DayStatus };

type Props = {
  days: Day[];
  max: number;
  unit: string;
  kind: "hours" | "kwh" | "percent";
  reference?: { value: number; label: string };
  marker?: { date: string; label: string };
  height?: number;
  compact?: boolean;
  caption: string;
};

const FORMAT = {
  hours,
  kwh,
  percent: (v: number) => `${(v * 100).toFixed(1)}%`,
};

const FILL: Record<DayStatus | "neutral", string> = {
  met: "bg-emerald-500",
  failed: "bg-rose-500",
  insufficient_data: "hatch",
  neutral: "bg-sky-500",
};

export function DayBars({ days, max, unit, kind, reference, marker, height = 200, compact = false, caption }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const format = FORMAT[kind];
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const hovered = active === null ? null : days[active];
  const markerIdx = marker ? days.findIndex((d) => d.date >= marker.date) : -1;

  return (
    <figure className="m-0">
      <div className="relative" style={{ height }} onMouseLeave={() => setActive(null)}>
        {!compact && (
          <div className="pointer-events-none absolute inset-0 border-b border-[var(--border-subtle)]" aria-hidden />
        )}
        <div className="absolute inset-0 flex items-end gap-[2px] sm:gap-1" aria-hidden>
          {days.map((d, i) => (
            <div
              key={d.date}
              className="relative flex h-full flex-1 items-end group"
              onMouseEnter={() => setActive(i)}
            >
              <div
                className={`w-full rounded-t-[3px] transition-all duration-150 ${FILL[d.status ?? "neutral"]} ${
                  active !== null && active !== i ? "opacity-40" : "opacity-100"
                }`}
                style={{
                  height: d.status === "insufficient_data" ? "100%" : pct(d.value),
                  minHeight: d.value > 0 ? 3 : 0,
                }}
              />
            </div>
          ))}
        </div>
        {reference && (
          <div
            className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-[var(--text-muted)]"
            style={{ bottom: pct(reference.value) }}
            aria-hidden
          >
            {!compact && (
              <span className="absolute -top-5.5 right-0 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted)] shadow-sm">
                {reference.label}
              </span>
            )}
          </div>
        )}
        {markerIdx >= 0 && marker && (
          <div
            className="pointer-events-none absolute inset-y-0 border-l-2 border-[var(--text-primary)]"
            style={{ left: `${(markerIdx / days.length) * 100}%` }}
            aria-hidden
          >
            <span className="absolute -top-1 left-1 whitespace-nowrap rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-primary)] shadow-sm">
              {marker.label}
            </span>
          </div>
        )}
        {hovered && active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute z-30 -translate-x-1/2 rounded-xl border-2 border-[var(--border-strong)] bg-white px-3 py-2 text-xs shadow-[4px_4px_0px_rgba(26,30,41,0.12)] transition-all"
            style={{
              left: `clamp(75px, ${((active + 0.5) / days.length) * 100}%, calc(100% - 75px))`,
              bottom: `calc(${pct(hovered.status === "insufficient_data" ? 0 : hovered.value)} + 10px)`,
            }}
          >
            <div className="font-semibold text-[var(--text-muted)] text-[11px]">{shortDate(hovered.date)}</div>
            <div className="text-sm font-bold text-[var(--text-primary)]">{format(hovered.value)}</div>
            {hovered.status && <div className="text-[var(--text-secondary)] font-medium text-[11px]">{DAY_STATUS_LABEL[hovered.status]}</div>}
          </div>
        )}
      </div>
      {!compact && (
        <div className="mt-2.5 flex justify-between text-xs text-[var(--text-muted)]" aria-hidden>
          <span>{shortDate(days[0].date)}</span>
          <span>{shortDate(days[days.length - 1].date)}</span>
        </div>
      )}
      <figcaption className={compact ? "sr-only" : "mt-3"}>
        <details className="text-xs text-[var(--text-secondary)]">
          <summary className="cursor-pointer select-none py-3 font-medium md:py-1 hover:text-[var(--text-primary)]">Show tabular breakdown</summary>
          <table className="mt-2 w-full max-w-md text-left text-xs">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                <th className="py-1 font-medium">Day</th>
                <th className="py-1 font-medium">{unit}</th>
                {days[0]?.status && <th className="py-1 font-medium">Status</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {days.map((d) => (
                <tr key={d.date}>
                  <td className="py-1">{shortDate(d.date)}</td>
                  <td className="py-1 font-medium">{format(d.value)}</td>
                  {d.status && <td className="py-1">{DAY_STATUS_LABEL[d.status]}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </figcaption>
    </figure>
  );
}
