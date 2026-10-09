"use client";

import Link from "next/link";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-[#0E1524] p-8 shadow-xl text-slate-100">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">Unable to Load Telemetry Data</h1>

      <p className="mt-2 text-sm text-slate-400 leading-relaxed">
        {process.env.NODE_ENV === "development"
          ? error.message
          : "The platform API service could not be reached or timed out. If running locally, check that the FastAPI server is active."}
      </p>

      {error.digest && (
        <p className="mt-3 font-mono text-xs text-slate-500">Error reference: {error.digest}</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-700 active:scale-[0.98]"
        >
          Retry Connection
        </button>
        <Link
          href="/"
          className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white transition"
        >
          Back to Portal Home
        </Link>
      </div>
    </div>
  );
}
