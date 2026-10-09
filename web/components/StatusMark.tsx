import { FEEDER_STATUS_LABEL, FLAG_STATUS_LABEL } from "@/lib/format";
import type { FeederStatus, FlagStatus } from "@/lib/types";

type Tone = "good" | "warn" | "bad" | "neutral";

const BADGE_STYLES: Record<Tone, { bg: string; text: string; border: string; dot: string }> = {
  good: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  warn: {
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-500/20",
    dot: "bg-amber-500",
  },
  bad: {
    bg: "bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-500/20",
    dot: "bg-rose-500",
  },
  neutral: {
    bg: "bg-slate-500/10",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-500/20",
    dot: "bg-slate-400",
  },
};

export function StatusMark({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const s = BADGE_STYLES[tone] ?? BADGE_STYLES.neutral;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-tight ${s.bg} ${s.text} ${s.border}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} aria-hidden />
      <span>{children}</span>
    </span>
  );
}

const FEEDER_TONE: Record<FeederStatus, Tone> = {
  compliant: "good",
  at_risk: "warn",
  downgrade: "bad",
  no_data: "neutral",
};

const FLAG_TONE: Record<FlagStatus, Tone> = {
  open: "warn",
  investigating: "neutral",
  confirmed: "bad",
  dismissed: "good",
};

export const FeederStatusMark = ({ status }: { status: FeederStatus }) => (
  <StatusMark tone={FEEDER_TONE[status]}>{FEEDER_STATUS_LABEL[status]}</StatusMark>
);

export const FlagStatusMark = ({ status }: { status: FlagStatus }) => (
  <StatusMark tone={FLAG_TONE[status]}>{FLAG_STATUS_LABEL[status]}</StatusMark>
);
