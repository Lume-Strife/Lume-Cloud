"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-[68ch]">
      <h1 className="text-2xl font-semibold">This page couldn&apos;t load its data</h1>
      <p className="mt-3 text-ink-2">
        {process.env.NODE_ENV === "development"
          ? error.message
          : "The platform API didn't respond. Check that it is running, then try again."}
      </p>
      <button type="button" onClick={reset} className="mt-6 rounded-md bg-ink px-4 py-2.5 font-semibold text-paper hover:opacity-90">
        Try again
      </button>
    </div>
  );
}
