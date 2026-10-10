import type { Case, DayStatus, FeederStatus, Flag, FlagStatus, TelemetrySource } from "./types";

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 });
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const month = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const stamp = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const money = (v: string | number) => naira.format(Number(v));
export const kwh = (v: string | number) => `${Number(v).toLocaleString("en-GB", { maximumFractionDigits: 1 })} kWh`;
export const hours = (v: number) => `${v.toFixed(1)}h`;
export const shortDate = (iso: string) => day.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
export const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
export const when = (iso: string) => stamp.format(new Date(iso));

/** "September 2026" when a period is one calendar month, otherwise "1 Sept – 30 Sept". */
export function periodLabel(start: string, endExclusive: string) {
  const s = new Date(`${start}T00:00:00Z`);
  const last = new Date(new Date(`${endExclusive}T00:00:00Z`).getTime() - 86_400_000);
  if (s.getUTCDate() === 1 && last.getUTCMonth() === s.getUTCMonth() && new Date(last.getTime() + 86_400_000).getUTCDate() === 1) {
    return month.format(s);
  }
  return `${day.format(s)} – ${day.format(last)}`;
}

export const RULE_LABEL: Record<Flag["rule"], string> = {
  tamper_event: "Tamper alarm",
  zero_with_supply: "Zero reading while power was on",
  consumption_drop: "Sudden drop in usage",
  feeder_imbalance: "Energy unaccounted for on feeder",
};

export const FLAG_STATUS_LABEL: Record<FlagStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  confirmed: "Confirmed",
  dismissed: "Dismissed",
};

export const FEEDER_STATUS_LABEL: Record<FeederStatus, string> = {
  compliant: "Meeting its band",
  at_risk: "Falling short",
  downgrade: "Downgrade due",
  no_data: "No telemetry",
};

export const TELEMETRY_SOURCE_LABEL: Record<TelemetrySource, string> = {
  simulated: "Simulated data",
  authorized_external: "Authorized external",
  lume_hardware: "Lume hardware verified",
  none: "NERC register only (no telemetry)",
  unknown: "Unverified",
};

export const DAY_STATUS_LABEL: Record<DayStatus, string> = {
  met: "Promise kept",
  failed: "Promise missed",
  insufficient_data: "Not enough data",
};

export const caseHref = (c: Pick<Case, "subject_type" | "subject_id">) => `/operations/cases/${c.subject_type}/${c.subject_id}`;

export const caseTitle = (c: Pick<Case, "subject_type" | "subject_id" | "feeder_id">) =>
  c.subject_type === "meter" ? `Meter ${c.subject_id} on feeder ${c.feeder_id}` : `Feeder ${c.subject_id} as a whole`;
