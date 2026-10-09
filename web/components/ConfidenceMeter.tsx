/** Confidence as an elegant colored bar with percentage indicator. */
export function ConfidenceMeter({ value }: { value: number }) {
  const label = value >= 0.75 ? "High Confidence" : value >= 0.5 ? "Moderate Signal" : "Weak Signal";
  const barColor =
    value >= 0.75
      ? "bg-rose-500"
      : value >= 0.5
      ? "bg-amber-500"
      : "bg-slate-400";

  return (
    <div className="flex items-center gap-2.5 text-xs" title={`Confidence: ${Math.round(value * 100)}% (${label})`}>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700" aria-hidden>
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="font-medium text-ink-2">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}
