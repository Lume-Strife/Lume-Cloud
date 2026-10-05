export type Role = "customer" | "operations" | "regulator";

export type User = {
  username: string;
  role: Role;
  display_name: string;
  meter_id: string | null;
};

export type DayStatus = "met" | "failed" | "insufficient_data";

export type ComplianceDay = {
  date: string;
  hours: number;
  coverage: number;
  exempt: boolean;
  status: DayStatus;
  streak: number;
};

export type FeederStatus = "compliant" | "at_risk" | "downgrade";

export type Compliance = {
  feeder_id: string;
  band: string;
  committed_hours: number;
  average_hours: number;
  days_met: number;
  days_failed: number;
  days_insufficient_data: number;
  compliance_rate: number | null;
  status: FeederStatus;
  explanation_dates: string[];
  downgrade_date: string | null;
  recommended_band: string | null;
  compensation_flag: boolean;
  special_compensation_days: number;
  days: ComplianceDay[];
};

export type FeederOverview = Omit<Compliance, "days"> & {
  meters: number;
  open_cases: number;
  unaccounted_kwh: number;
};

export type FlagStatus = "open" | "investigating" | "confirmed" | "dismissed";

export type Flag = {
  flag_id: string | number;
  rule: "tamper_event" | "zero_with_supply" | "consumption_drop" | "feeder_imbalance";
  subject_type: "meter" | "feeder";
  subject_id: string;
  feeder_id: string;
  period_start: string;
  period_end: string;
  reason: string;
  confidence: number;
  evidence: Record<string, unknown>;
  status: FlagStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
};

export type BillLine = { description: string; kwh: string; rate: string; amount: string; estimated: boolean };

export type Bill = {
  meter_id: string;
  feeder_id: string;
  band: string;
  period_start: string;
  period_end: string;
  currency: string;
  tariff_version: string;
  lines: BillLine[];
  subtotal: string;
  vat: string;
  total: string;
  recommendations: { type: string; description: string; amount: string | null }[];
  data_quality: {
    expected_slots: number;
    metered_slots: number;
    estimated_slots: number;
    unbilled_unknown_slots: number;
  };
};

export type CustomerSummary = {
  meter_id: string;
  period: { start: string; end: string };
  bill: Bill;
  supply: Pick<Compliance, "band" | "committed_hours" | "average_hours" | "days_met" | "days_failed" | "days_insufficient_data" | "status">;
  daily: { date: string; kwh: number; supply_hours: number; status: DayStatus }[];
};

/** Every flag raised against one meter or feeder; decided together after a field visit. */
export type Case = {
  subject_type: "meter" | "feeder";
  subject_id: string;
  feeder_id: string;
  confidence: number;
  status: FlagStatus;
  period_start: string;
  period_end: string;
  flags: Flag[];
};

export type CaseDetail = Case & {
  meter?: Omit<MeterDetail, "flags">;
  suspect_cases?: Omit<Case, "flags">[];
};

export type MeterDetail = {
  meter_id: string;
  feeder_id: string;
  daily: { date: string; kwh: number; supply_hours: number }[];
  flags: Flag[];
};

export type AuditEntry = {
  seq: number;
  at: string;
  actor: string;
  action: string;
  target: string;
  details: Record<string, unknown>;
};

export type AuditLog = { chain_intact: boolean; first_broken_seq: number | null; entries: AuditEntry[] };
