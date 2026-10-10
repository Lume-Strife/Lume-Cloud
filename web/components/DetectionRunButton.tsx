"use client";

import { useFormStatus } from "react-dom";
import { useEffect, useState } from "react";

export function DetectionRunButton() {
  const { pending } = useFormStatus();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!pending) return;
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [pending]);

  const displayElapsed = pending ? elapsed : 0;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="submit"
        disabled={pending}
        className={`relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
          pending
            ? "cursor-wait border-2 border-[var(--border-default)] bg-amber-100 text-amber-900 shadow-[2px_2px_0px_rgba(26,30,41,0.06)]"
            : "border-2 border-[var(--border-strong)] bg-amber-400 text-[var(--text-primary)] shadow-[2px_2px_0px_rgba(26,30,41,0.12)] hover:bg-amber-300 active:scale-[0.98]"
        }`}
        title="Check every meter's readings for this period"
      >
        {pending ? (
          <>
            <svg
              className="h-4 w-4 animate-spin text-amber-900"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Scanning… {displayElapsed}s</span>
          </>
        ) : (
          <>
            <svg className="h-4 w-4 text-[var(--text-primary)]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                clipRule="evenodd"
              />
            </svg>
            <span>Scan for new leads</span>
          </>
        )}
      </button>
      {pending && (
        <span className="text-[11px] text-[var(--text-muted)] font-medium">
          This takes about 15 seconds.
        </span>
      )}
    </div>
  );
}
