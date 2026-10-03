"use client";

import { useState } from "react";

import { DAY_STATUS_LABEL, hours, kwh, shortDate } from "@/lib/format";
import type { DayStatus } from "@/lib/types";

type Day = { date: string; value: number; status?: DayStatus };

type Props = {
  days: Day[];
  max: number;
  unit: string;
  /** How values are written. A name rather than a function, so server pages can pass it. */
  kind: "hours" | "kwh" | "percent";
  /** Horizontal promise line, e.g. the Band's committed hours. */
  reference?: { value: number; label: string };
  /** Date from which something changed, drawn as a vertical marker. */
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
  met: "bg-met",
  failed: "bg-breach",
  insufficient_data: "hatch",
  neutral: "bg-lamp",
};

/** One column per day. Bars with a status are judged against the reference line, so
 *  height relative to the line repeats what the color says. */
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
          <div className="pointer-events-none absolute inset-0 border-b border-rule-strong" aria-hidden />
        )}
        <div className="absolute inset-0 flex items-end gap-[2px]" aria-hidden>
          {days.map((d, i) => (
            <div
              key={d.date}
              className="relative flex h-full flex-1 items-end"
              onMouseEnter={() => setActive(i)}
            >
              <div
                className={`w-full rounded-t-[4px] ${FILL[d.status ?? "neutral"]} ${active !== null && active !== i ? "opacity-55" : ""}`}
                style={{ height: d.status === "insufficient_data" ? "100%" : pct(d.value), minHeight: d.value > 0 ? 2 : 0 }}
              />
            </div>
          ))}
        </div>
        {reference && (
          <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-ink" style={{ bottom: pct(reference.value) }} aria-hidden>
            {!compact && (
              <span className="absolute -top-6 right-0 bg-surface px-1 text-xs font-medium text-ink">{reference.label}</span>
            )}
          </div>
        )}
        {markerIdx >= 0 && marker && (
          <div
            className="pointer-events-none absolute inset-y-0 border-l-2 border-ink"
            style={{ left: `${(markerIdx / days.length) * 100}%` }}
            aria-hidden
          >
            <span className="absolute -top-1 left-1 whitespace-nowrap bg-surface px-1 text-xs font-medium text-ink">{marker.label}</span>
          </div>
        )}
        {hovered && active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-rule-strong bg-surface px-3 py-2 text-sm shadow-lg"
            style={{
              left: `clamp(70px, ${((active + 0.5) / days.length) * 100}%, calc(100% - 70px))`,
              bottom: `calc(${pct(hovered.status === "insufficient_data" ? 0 : hovered.value)} + 10px)`,
            }}
          >
            <div className="text-muted">{shortDate(hovered.date)}</div>
            <div className="font-semibold text-ink">{format(hovered.value)}</div>
            {hovered.status && <div className="text-ink-2">{DAY_STATUS_LABEL[hovered.status]}</div>}
          </div>
        )}
      </div>
      {!compact && (
        <div className="mt-2 flex justify-between text-xs text-muted" aria-hidden>
          <span>{shortDate(days[0].date)}</span>
          <span>{shortDate(days[days.length - 1].date)}</span>
        </div>
      )}
      <figcaption className={compact ? "sr-only" : "mt-3"}>
        <details className="text-sm text-ink-2">
          <summary className="cursor-pointer select-none text-ink-2 hover:text-ink">Show as table</summary>
          <table className="mt-2 w-full max-w-md text-left">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-rule text-muted">
                <th className="py-1 font-medium">Day</th>
                <th className="py-1 font-medium">{unit}</th>
                {days[0]?.status && <th className="py-1 font-medium">Result</th>}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date} className="border-b border-rule">
                  <td className="py-1">{shortDate(d.date)}</td>
                  <td className="py-1">{format(d.value)}</td>
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
