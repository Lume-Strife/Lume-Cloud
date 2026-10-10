/** Shown while a dashboard fetches its data from the platform API. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">Loading dashboard data…</span>
      <div className="flex flex-col gap-3" aria-hidden>
        <div className="h-5 w-40 animate-pulse rounded-full bg-[var(--bg-subtle)]" />
        <div className="h-9 w-72 max-w-full animate-pulse rounded-lg bg-[var(--bg-subtle)]" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-[var(--bg-subtle)]" />
      </div>
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border-2 border-[var(--border-subtle)] bg-white" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl border-2 border-[var(--border-subtle)] bg-white" aria-hidden />
    </div>
  );
}
