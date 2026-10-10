import type { TelemetrySource } from "@/lib/types";

type Props = {
  source: TelemetrySource;
  labelPrefix?: string;
  className?: string;
};

const STYLES: Record<TelemetrySource, { bg: string; text: string; border: string; label: string; dot: string }> = {
  simulated: {
    bg: "bg-amber-500/10",
    text: "text-amber-700",
    border: "border-amber-500/20",
    label: "Simulated data",
    dot: "bg-amber-500",
  },
  lume_hardware: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-700",
    border: "border-emerald-500/20",
    label: "Lume hardware",
    dot: "bg-emerald-500 shadow-xs shadow-emerald-500/50",
  },
  authorized_external: {
    bg: "bg-sky-500/10",
    text: "text-sky-700",
    border: "border-sky-500/20",
    label: "Authorized feed",
    dot: "bg-sky-500 shadow-xs shadow-sky-500/50",
  },
  none: {
    bg: "bg-[var(--bg-subtle)]",
    text: "text-[var(--text-secondary)]",
    border: "border-[var(--border-default)]",
    label: "NERC register, no telemetry",
    dot: "bg-[var(--status-nodata)]",
  },
  unknown: {
    bg: "bg-stone-500/10",
    text: "text-stone-600",
    border: "border-stone-500/20",
    label: "Source not verified",
    dot: "bg-stone-400",
  },
};

export function TelemetrySourceBadge({ source, labelPrefix, className = "" }: Props) {
  const conf = STYLES[source] ?? STYLES.unknown;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-tight ${conf.bg} ${conf.text} ${conf.border} ${className}`}
      title={`Telemetry source: ${conf.label}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${conf.dot}`} aria-hidden />
      <span>{labelPrefix ? `${labelPrefix}: ${conf.label}` : conf.label}</span>
    </span>
  );
}
