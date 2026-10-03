import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { DayBars } from "@/components/DayBars";
import { FlagStatusMark } from "@/components/StatusMark";
import { ApiError, apiFetch } from "@/lib/api";
import { kwh, periodLabel, RULE_LABEL, shortDate, when } from "@/lib/format";
import { requireRole } from "@/lib/session";
import type { Flag, MeterDetail } from "@/lib/types";

import { DecisionForm } from "./DecisionForm";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function evidenceRows(f: Flag): [string, string][] {
  const e = f.evidence as Record<string, never>;
  switch (f.rule) {
    case "tamper_event":
      return [
        ["Tamper alarms", String(e.count)],
        ["First alarm", when(e.first)],
        ["Last alarm", when(e.last)],
      ];
    case "zero_with_supply":
      return [
        ["Hours reading zero with power on", `${e.zero_hours}h`],
        ["Hours the feeder supplied power", `${e.supplied_hours}h`],
        ["First zero reading", when(e.first)],
      ];
    case "consumption_drop":
      return [
        ["Normal use", `${e.baseline_kwh_per_hour} kWh per hour of supply`],
        ["Recent use", `${e.recent_kwh_per_hour} kWh per hour of supply`],
        ["Drop", pct(e.drop)],
        ["Low since", `${shortDate(e.low_since)} (${e.low_days} days)`],
        ["Day-to-day variation before the drop", pct(e.baseline_variability)],
      ];
    case "feeder_imbalance":
      return [
        ["Days over the loss limit", String(e.days_over_limit)],
        ["Average loss on those days", pct(e.average_loss)],
        ["Expected technical loss", pct(e.expected_loss)],
        ["Energy unaccounted for", kwh(e.unaccounted_kwh)],
        ["Meters also flagged", (e.suspect_meters as string[]).join(", ") || "None"],
      ];
  }
}

export default async function FlagPage({ params, searchParams }: PageProps<"/operations/flags/[id]">) {
  await requireRole("operations");
  const { id } = await params;
  const { saved } = await searchParams;
  if (!/^\d+$/.test(id)) notFound();
  const flag = await apiFetch<Flag>(`/ops/flags/${id}`).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const period = `from=${flag.period_start}&to=${flag.period_end}`;
  const meter = flag.subject_type === "meter" ? await apiFetch<MeterDetail>(`/ops/meters/${flag.subject_id}?${period}`) : null;
  const marker = flag.evidence.low_since ?? (flag.rule === "zero_with_supply" ? String(flag.evidence.first).slice(0, 10) : undefined);
  const dailyLoss = flag.rule === "feeder_imbalance" ? Object.entries(flag.evidence.daily_loss as Record<string, number>) : [];

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Link href="/operations#flags" className="text-sm text-ink-2 underline underline-offset-2">
          Back to all flags
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">{RULE_LABEL[flag.rule]}</h1>
        <p className="mt-1 text-lg text-ink-2">
          {flag.subject_type === "meter" ? `Meter ${flag.subject_id} on feeder ${flag.feeder_id}` : `Feeder ${flag.subject_id}`},{" "}
          {periodLabel(flag.period_start, flag.period_end)}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <ConfidenceMeter value={flag.confidence} />
          <FlagStatusMark status={flag.status} />
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-8">
          <section aria-labelledby="why-heading">
            <h2 id="why-heading" className="text-xl font-semibold">Why this was flagged</h2>
            <p className="mt-2 max-w-[68ch] text-ink-2">{flag.reason}.</p>
            <dl className="mt-4 divide-y divide-rule border-y border-rule">
              {evidenceRows(flag).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[1fr_auto] gap-4 py-2.5">
                  <dt className="text-ink-2">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          {meter && (
            <section aria-labelledby="usage-heading">
              <h2 id="usage-heading" className="text-xl font-semibold">Energy this meter recorded each day</h2>
              <div className="mt-4 rounded-lg border border-rule bg-surface p-4 pt-8 md:p-6 md:pt-8">
                <DayBars
                  days={meter.daily.map((d) => ({ date: d.date, value: d.kwh }))}
                  max={Math.max(...meter.daily.map((d) => d.kwh), 0.1) * 1.15}
                  unit="Energy recorded"
                  kind="kwh"
                  height={180}
                  marker={marker ? { date: String(marker), label: "Change starts" } : undefined}
                  caption={`Energy recorded each day by meter ${meter.meter_id}`}
                />
              </div>
              <h3 className="mt-6 font-semibold">Hours the feeder had power each day</h3>
              <p className="text-sm text-ink-2">If these stay steady while recorded energy falls, the drop is not explained by outages.</p>
              <div className="mt-3 rounded-lg border border-rule bg-surface p-4 md:p-6">
                <DayBars
                  days={meter.daily.map((d) => ({ date: d.date, value: d.supply_hours }))}
                  max={24}
                  unit="Hours of supply"
                  kind="hours"
                  height={90}
                  caption={`Hours of supply each day on feeder ${meter.feeder_id}`}
                />
              </div>
            </section>
          )}

          {dailyLoss.length > 0 && (
            <section aria-labelledby="loss-heading">
              <h2 id="loss-heading" className="text-xl font-semibold">Share of feeder energy that was never metered</h2>
              <div className="mt-4 rounded-lg border border-rule bg-surface p-4 pt-8 md:p-6 md:pt-10">
                <DayBars
                  days={dailyLoss.map(([date, v]) => ({ date, value: Math.max(0, v) }))}
                  max={Math.max(...dailyLoss.map(([, v]) => v), 0.2) * 1.15}
                  unit="Unmetered share"
                  kind="percent"
                  height={180}
                  reference={{ value: Number(flag.evidence.expected_loss), label: `Expected loss ${pct(Number(flag.evidence.expected_loss))}` }}
                  caption={`Daily unmetered share of energy on feeder ${flag.subject_id}`}
                />
              </div>
            </section>
          )}
        </div>

        <aside aria-labelledby="decision-heading" className="self-start rounded-lg border border-rule bg-surface p-6">
          <h2 id="decision-heading" className="text-xl font-semibold">Record a decision</h2>
          {saved && <p role="status" className="mt-3 border-l-4 border-met pl-3 text-sm">Decision recorded in the audit trail.</p>}
          {flag.decided_by && (
            <p className="mt-3 text-sm text-ink-2">
              Last updated by {flag.decided_by} on {when(flag.decided_at!)}
              {flag.decision_note ? `: “${flag.decision_note}”` : "."}
            </p>
          )}
          <div className="mt-5">
            <DecisionForm flagId={flag.flag_id} current={flag.status} />
          </div>
        </aside>
      </div>
    </div>
  );
}
