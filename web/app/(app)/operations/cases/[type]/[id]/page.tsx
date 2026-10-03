import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { DayBars } from "@/components/DayBars";
import { FlagStatusMark } from "@/components/StatusMark";
import { ApiError, apiFetch } from "@/lib/api";
import { caseHref, caseTitle, kwh, periodLabel, plural, RULE_LABEL, shortDate, when } from "@/lib/format";
import { requireRole } from "@/lib/session";
import type { CaseDetail, Flag } from "@/lib/types";

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
      ];
  }
}

/** The earliest date any signal says the meter's behaviour changed. */
function changeStart(flags: Flag[]): string | undefined {
  const dates = flags
    .map((f) => (f.rule === "consumption_drop" ? f.evidence.low_since : f.rule === "zero_with_supply" ? f.evidence.first : undefined))
    .filter((d): d is string => typeof d === "string")
    .map((d) => d.slice(0, 10));
  return dates.sort()[0];
}

export default async function CasePage({ params, searchParams }: PageProps<"/operations/cases/[type]/[id]">) {
  await requireRole("operations");
  const { type, id } = await params;
  const { saved } = await searchParams;
  if ((type !== "meter" && type !== "feeder") || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  const c = await apiFetch<CaseDetail>(`/ops/cases/${type}/${id}`).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const decided = c.flags.filter((f) => f.decided_at).sort((a, b) => b.decided_at!.localeCompare(a.decided_at!))[0];
  const marker = changeStart(c.flags);
  const imbalance = c.flags.find((f) => f.rule === "feeder_imbalance");
  const dailyLoss = imbalance ? Object.entries(imbalance.evidence.daily_loss as Record<string, number>) : [];

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Link href="/operations#cases" className="text-sm text-ink-2 underline underline-offset-2">
          Back to all cases
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">{caseTitle(c)}</h1>
        <p className="mt-1 text-lg text-ink-2">
          {plural(c.flags.length, "signal", "signals")}, {periodLabel(c.period_start, c.period_end)}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <ConfidenceMeter value={c.confidence} />
          <FlagStatusMark status={c.status} />
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-10">
          <section aria-labelledby="why-heading">
            <h2 id="why-heading" className="text-xl font-semibold">Why this was flagged</h2>
            <div className="mt-4 flex flex-col gap-6">
              {c.flags.map((f) => (
                <article key={f.flag_id} aria-labelledby={`flag-${f.flag_id}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <h3 id={`flag-${f.flag_id}`} className="font-semibold">{RULE_LABEL[f.rule]}</h3>
                    <ConfidenceMeter value={f.confidence} />
                  </div>
                  <p className="mt-1 max-w-[68ch] text-ink-2">{f.reason}.</p>
                  <dl className="mt-3 divide-y divide-rule border-y border-rule">
                    {evidenceRows(f).map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[1fr_auto] gap-4 py-2">
                        <dt className="text-ink-2">{k}</dt>
                        <dd className="text-right font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>
          </section>

          {c.meter && (
            <section aria-labelledby="usage-heading">
              <h2 id="usage-heading" className="text-xl font-semibold">Energy this meter recorded each day</h2>
              <div className="mt-4 rounded-lg border border-rule bg-surface p-4 pt-8 md:p-6 md:pt-8">
                <DayBars
                  days={c.meter.daily.map((d) => ({ date: d.date, value: d.kwh }))}
                  max={Math.max(...c.meter.daily.map((d) => d.kwh), 0.1) * 1.15}
                  unit="Energy recorded"
                  kind="kwh"
                  height={180}
                  marker={marker ? { date: marker, label: "Change starts" } : undefined}
                  caption={`Energy recorded each day by meter ${c.subject_id}`}
                />
              </div>
              <h3 className="mt-6 font-semibold">Hours the feeder had power each day</h3>
              <p className="text-sm text-ink-2">If these stay steady while recorded energy falls, the drop is not explained by outages.</p>
              <div className="mt-3 rounded-lg border border-rule bg-surface p-4 md:p-6">
                <DayBars
                  days={c.meter.daily.map((d) => ({ date: d.date, value: d.supply_hours }))}
                  max={24}
                  unit="Hours of supply"
                  kind="hours"
                  height={90}
                  caption={`Hours of supply each day on feeder ${c.feeder_id}`}
                />
              </div>
            </section>
          )}

          {imbalance && (
            <section aria-labelledby="loss-heading">
              <h2 id="loss-heading" className="text-xl font-semibold">Share of feeder energy that was never metered</h2>
              <div className="mt-4 rounded-lg border border-rule bg-surface p-4 pt-8 md:p-6 md:pt-10">
                <DayBars
                  days={dailyLoss.map(([date, v]) => ({ date, value: Math.max(0, v) }))}
                  max={Math.max(...dailyLoss.map(([, v]) => v), 0.2) * 1.15}
                  unit="Unmetered share"
                  kind="percent"
                  height={180}
                  reference={{ value: Number(imbalance.evidence.expected_loss), label: `Expected loss ${pct(Number(imbalance.evidence.expected_loss))}` }}
                  caption={`Daily unmetered share of energy on feeder ${c.subject_id}`}
                />
              </div>
            </section>
          )}

          {c.suspect_cases && (
            <section aria-labelledby="suspects-heading">
              <h2 id="suspects-heading" className="text-xl font-semibold">Meters on this feeder with their own cases</h2>
              {c.suspect_cases.length === 0 ? (
                <p className="mt-2 text-ink-2">No individual meter explains the loss yet. Look for bypasses upstream of the meters.</p>
              ) : (
                <ul className="mt-3 divide-y divide-rule border-y border-rule">
                  {c.suspect_cases.map((s) => (
                    <li key={s.subject_id}>
                      <Link href={caseHref(s)} className="flex flex-wrap items-center justify-between gap-4 py-2.5 hover:bg-surface">
                        <span className="font-medium underline underline-offset-2">Meter {s.subject_id}</span>
                        <span className="flex items-center gap-6">
                          <ConfidenceMeter value={s.confidence} />
                          <FlagStatusMark status={s.status} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <aside aria-labelledby="decision-heading" className="self-start rounded-lg border border-rule bg-surface p-6">
          <h2 id="decision-heading" className="text-xl font-semibold">Record what you found</h2>
          <p className="mt-1 text-sm text-ink-2">One decision covers every signal in this case.</p>
          {saved && <p role="status" className="mt-3 border-l-4 border-met pl-3 text-sm">Decision recorded in the audit trail.</p>}
          {decided && (
            <p className="mt-3 text-sm text-ink-2">
              Last updated by {decided.decided_by} on {when(decided.decided_at!)}
              {decided.decision_note ? `: “${decided.decision_note}”` : "."}
            </p>
          )}
          <div className="mt-5">
            <DecisionForm subjectType={c.subject_type} subjectId={c.subject_id} current={c.status} />
          </div>
        </aside>
      </div>
    </div>
  );
}
