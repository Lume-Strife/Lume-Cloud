/** Confidence as a short bar plus the number, so it reads without color. */
export function ConfidenceMeter({ value }: { value: number }) {
  const label = value >= 0.75 ? "Strong" : value >= 0.5 ? "Moderate" : "Weak";
  return (
    <div className="flex items-center gap-2 text-sm" title={`Confidence ${Math.round(value * 100)}%`}>
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-rule" aria-hidden>
        <div className="h-full rounded-full bg-ink" style={{ width: `${value * 100}%` }} />
      </div>
      <span className="text-ink-2">
        {label} <span className="sr-only">evidence, </span>
        <span className="text-muted">{Math.round(value * 100)}%</span>
      </span>
    </div>
  );
}
