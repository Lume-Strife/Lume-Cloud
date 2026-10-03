import { FEEDER_STATUS_LABEL, FLAG_STATUS_LABEL } from "@/lib/format";
import type { FeederStatus, FlagStatus } from "@/lib/types";

type Tone = "good" | "warn" | "bad" | "neutral";

const COLOR: Record<Tone, string> = {
  good: "text-met",
  warn: "text-lamp",
  bad: "text-breach",
  neutral: "text-muted",
};

/** Status never relies on color alone: each tone has its own glyph, and the label is in ink. */
function Glyph({ tone }: { tone: Tone }) {
  const common = { width: 14, height: 14, viewBox: "0 0 14 14", "aria-hidden": true, className: `shrink-0 ${COLOR[tone]}` };
  if (tone === "good")
    return (
      <svg {...common}>
        <circle cx="7" cy="7" r="7" fill="currentColor" />
        <path d="M3.8 7.2l2.1 2.1 4.3-4.6" stroke="var(--surface)" strokeWidth="1.8" fill="none" />
      </svg>
    );
  if (tone === "bad")
    return (
      <svg {...common}>
        <rect width="14" height="14" rx="2" fill="currentColor" />
        <path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="var(--surface)" strokeWidth="1.8" />
      </svg>
    );
  if (tone === "warn")
    return (
      <svg {...common}>
        <path d="M7 0.8L13.4 12.6H0.6z" fill="currentColor" />
        <path d="M7 5v3.6M7 10.2v0.6" stroke="var(--ink)" strokeWidth="1.6" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function StatusMark({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-ink">
      <Glyph tone={tone} />
      {children}
    </span>
  );
}

const FEEDER_TONE: Record<FeederStatus, Tone> = { compliant: "good", at_risk: "warn", downgrade: "bad" };
const FLAG_TONE: Record<FlagStatus, Tone> = { open: "warn", investigating: "neutral", confirmed: "bad", dismissed: "good" };

export const FeederStatusMark = ({ status }: { status: FeederStatus }) => (
  <StatusMark tone={FEEDER_TONE[status]}>{FEEDER_STATUS_LABEL[status]}</StatusMark>
);

export const FlagStatusMark = ({ status }: { status: FlagStatus }) => (
  <StatusMark tone={FLAG_TONE[status]}>{FLAG_STATUS_LABEL[status]}</StatusMark>
);
