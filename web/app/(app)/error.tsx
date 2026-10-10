"use client";

import Link from "next/link";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border-2 border-[var(--border-default)] bg-white p-8 shadow-[4px_4px_0px_rgba(26,30,41,0.08)] text-[var(--text-primary)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-rose-300 bg-rose-50 text-rose-700 shadow-[2px_2px_0px_rgba(244,63,94,0.1)]">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>

      <h1 className="mt-4 text-2xl font-black tracking-tight text-[var(--text-primary)]">Unable to Load Telemetry Data</h1>

      <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
        {process.env.NODE_ENV === "development"
          ? error.message
          : "The platform API service could not be reached or timed out. Please check your network connection or verify that the API service is active."}
      </p>

      {error.digest && (
        <p className="mt-3 font-mono text-xs text-[var(--text-muted)]">Error reference: {error.digest}</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border-2 border-[var(--border-strong)] bg-amber-400 px-4 py-2 text-xs font-bold text-[var(--text-primary)] shadow-[2px_2px_0px_rgba(26,30,41,0.12)] transition hover:bg-amber-300 active:scale-[0.98]"
        >
          Retry Connection
        </button>
        <Link
          href="/"
          className="rounded-xl border-2 border-[var(--border-default)] bg-white px-4 py-2 text-xs font-bold text-[var(--text-secondary)] shadow-[2px_2px_0px_rgba(26,30,41,0.06)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition"
        >
          Back to Portal Home
        </Link>
      </div>
    </div>
  );
}
