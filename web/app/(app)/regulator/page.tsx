import Link from "next/link";
import { DayBars } from "@/components/DayBars";
import { FeederStatusMark } from "@/components/StatusMark";
import { TelemetrySourceBadge } from "@/components/TelemetrySourceBadge";
import { OfficialFeederMetadataCard } from "@/components/OfficialFeederMetadataCard";
import { apiFetch } from "@/lib/api";
import { hours, periodLabel, shortDate } from "@/lib/format";
import { requireRole } from "@/lib/session";
import type { Compliance } from "@/lib/types";

type PageProps = {
  searchParams: Promise<{ include_untracked?: string }>;
};

export const dynamic = "force-dynamic";

export default async function RegulatorPage({ searchParams }: PageProps) {
  await requireRole("regulator");
  const params = await searchParams;
  const includeUntracked = params?.include_untracked === "true";

  const [period, feeders] = await Promise.all([
    apiFetch<{ start: string; end: string }>("/period"),
    apiFetch<Compliance[]>(`/regulator/compliance${includeUntracked ? "?include_untracked=true" : ""}`),
  ]);

  // Under NERC rules: only at_risk and downgrade count as breaches. no_data is untracked/unknown, never breached.
  const breached = feeders.filter((f) => f.status === "at_risk" || f.status === "downgrade").length;
  const compliant = feeders.filter((f) => f.status === "compliant").length;
  const downgrades = feeders.filter((f) => f.downgrade_date).length;
  const explanations = feeders.reduce((sum, f) => sum + f.explanation_dates.length, 0);
  const compensations = feeders.filter((f) => f.compensation_flag).length;

  const exportUrl = `/regulator/export${includeUntracked ? "?include_untracked=true" : ""}`;

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="section-pill">
              NERC Service Accountability
            </span>
            <span className="text-xs text-[var(--text-muted)] font-medium">Order NERC/2024/032</span>
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--text-primary)]">
            Feeder Compliance: {periodLabel(period.start, period.end)}
          </h1>
          <p className="mt-1.5 max-w-[72ch] text-sm text-[var(--text-secondary)] leading-relaxed">
            Independent verification of DisCo feeder supply hours against committed Band A–E standards and the statutory NERC 7-Day Rule.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={exportUrl}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-[var(--border-strong)] bg-white px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] shadow-[2px_2px_0px_rgba(26,30,41,0.08)] transition hover:border-amber-500 hover:text-amber-700 active:scale-[0.98]"
            download
          >
            <svg className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span>Download Evidence (CSV)</span>
          </a>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        <div className="card-comic p-4 transition-all hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Feeders</span>
            <span className="h-2 w-2 rounded-full bg-slate-400" />
          </div>
          <p className="figure mt-2.5 text-2xl font-black text-[var(--text-primary)]">{feeders.length}</p>
          <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">
            {includeUntracked ? "Live & registered" : "Live telemetry"}
          </span>
        </div>

        <div className="card-comic p-4 transition-all hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Meeting Band</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <p className="figure mt-2.5 text-2xl font-black text-emerald-600">{compliant}</p>
          <span className="mt-0.5 block text-[11px] text-emerald-700 font-medium">Kept commitments</span>
        </div>

        <div className="card-comic p-4 transition-all hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Falling Short</span>
            <span className="h-2 w-2 rounded-full bg-amber-500" />
          </div>
          <p className="figure mt-2.5 text-2xl font-black text-amber-600">{breached}</p>
          <span className="mt-0.5 block text-[11px] text-amber-700 font-medium">At risk of breach</span>
        </div>

        <div className="card-comic p-4 transition-all hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">7-Day Downgrades</span>
            <span className="h-2 w-2 rounded-full bg-rose-500" />
          </div>
          <p className="figure mt-2.5 text-2xl font-black text-rose-600">{downgrades}</p>
          <span className="mt-0.5 block text-[11px] text-rose-700 font-medium">Mandated tariff drops</span>
        </div>

        <div className="card-comic p-4 transition-all hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Explanations</span>
            <span className="h-2 w-2 rounded-full bg-slate-400" />
          </div>
          <p className="figure mt-2.5 text-2xl font-black text-[var(--text-primary)]">{explanations}</p>
          <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">≥2 consecutive failures</span>
        </div>

        <div className="card-comic p-4 transition-all hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600">Compensation</span>
            <span className="h-2 w-2 rounded-full bg-sky-500" />
          </div>
          <p className="figure mt-2.5 text-2xl font-black text-sky-600">{compensations}</p>
          <span className="mt-0.5 block text-[11px] text-sky-700 font-medium">Eligible for credits</span>
        </div>
      </div>

      {/* Filter and Register Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-[var(--border-default)] bg-white px-4 py-3 shadow-[3px_3px_0px_rgba(26,30,41,0.06)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[var(--text-primary)]">Filter View:</span>
          <Link
            href="/regulator"
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              !includeUntracked
                ? "border-2 border-slate-900 bg-amber-400 text-slate-950 shadow-[2px_2px_0px_rgba(26,30,41,0.12)]"
                : "border-2 border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            }`}
          >
            Live Telemetry Only
          </Link>
          <Link
            href="/regulator?include_untracked=true"
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              includeUntracked
                ? "border-2 border-slate-900 bg-amber-400 text-slate-950 shadow-[2px_2px_0px_rgba(26,30,41,0.12)]"
                : "border-2 border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            }`}
          >
            Include Untracked NERC Register (+21 Kwara Feeders)
          </Link>
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] font-medium">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
          <span>Simulated demo data is explicitly labeled per audit standards</span>
        </div>
      </div>

      {includeUntracked && (
        <div className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-4 text-xs text-sky-950 shadow-[3px_3px_0px_rgba(14,165,233,0.1)]">
          <p className="font-bold text-sm text-sky-900">Official NERC Feeder Register Included</p>
          <p className="mt-1 max-w-[80ch] leading-relaxed text-sky-950/90">
            Displaying 21 official Kwara State / Challenge Business Unit feeders transcribed from NERC’s published September 2026 energy cap bulletin (including UNILORIN 33KV Band A). Because DisCos have not yet deployed public telemetry loggers to these lines, their status is recorded as <strong>Untracked / No data</strong>. Under regulatory rules, untracked status is never judged as compliant or breached.
          </p>
        </div>
      )}

      {/* Feeder List */}
      <ul className="flex flex-col gap-4">
        {feeders.map((f) => {
          const hasReadings = f.days && f.days.length > 0;

          return (
            <li key={f.feeder_id} className="rounded-2xl border-2 border-[var(--border-default)] bg-white p-5 sm:p-6 shadow-[3px_3px_0px_rgba(26,30,41,0.06)] transition-all hover:border-[var(--border-strong)] hover:shadow-[4px_4px_0px_rgba(26,30,41,0.1)]">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-slate-100 pb-3.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">
                    {f.feeder_id}
                  </h2>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    Band {f.band} ({f.committed_hours}h/day)
                  </span>
                  <TelemetrySourceBadge source={f.feeder_telemetry_source} />
                </div>
                <FeederStatusMark status={f.status} />
              </div>

              {/* Official NERC metadata banner if present */}
              {f.official && (
                <div className="mt-3.5">
                  <OfficialFeederMetadataCard metadata={f.official} compact />
                </div>
              )}

              {/* Supply Details and Telemetry Chart */}
              {hasReadings ? (
                <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px]">
                  <div className="pt-2">
                    <DayBars
                      days={f.days.map((d) => ({ date: d.date, value: d.hours, status: d.status }))}
                      max={24}
                      unit="Hours of supply"
                      kind="hours"
                      reference={{ value: f.committed_hours, label: `Committed ${f.committed_hours}h` }}
                      height={80}
                      compact
                      caption={`Daily hours of supply on feeder ${f.feeder_id}`}
                    />
                    <div className="mt-2.5 flex justify-between text-xs text-slate-400" aria-hidden>
                      <span>{shortDate(f.days[0].date)}</span>
                      <span className="font-medium text-slate-600">
                        {f.days_met} of {f.days_met + f.days_failed} days achieved
                      </span>
                      <span>{shortDate(f.days[f.days.length - 1].date)}</span>
                    </div>
                  </div>

                  <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-xs sm:text-sm">
                    <dt className="whitespace-nowrap text-slate-500">Average delivered</dt>
                    <dd className="text-right font-semibold text-slate-900">{hours(f.average_hours)} a day</dd>

                    <dt className="whitespace-nowrap text-slate-500">Days promise kept</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {f.days_met} of {f.days_met + f.days_failed}
                      {f.days_insufficient_data > 0 && ` (${f.days_insufficient_data} no data)`}
                    </dd>

                    <dt className="whitespace-nowrap text-slate-500">Explanations owed</dt>
                    <dd className="text-right font-medium text-slate-900" title={f.explanation_dates.map(shortDate).join(", ")}>
                      {f.explanation_dates.length > 0 ? (
                        <span className="text-amber-700 font-bold">{f.explanation_dates.length} incidents</span>
                      ) : (
                        "None"
                      )}
                    </dd>

                    <dt className="whitespace-nowrap text-slate-500">7-Day Rule</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {f.downgrade_date ? (
                        <span className="text-rose-600 font-bold">
                          Downgrade to Band {f.recommended_band ?? "below E"} ({shortDate(f.downgrade_date)})
                        </span>
                      ) : (
                        "Compliant / Not triggered"
                      )}
                    </dd>

                    <dt className="whitespace-nowrap text-slate-500">Compensation status</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {f.compensation_flag ? (
                        <span className="text-emerald-700 font-semibold">Customers eligible</span>
                      ) : (
                        "Standard tariff applies"
                      )}
                    </dd>
                  </dl>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">No telemetry recordings for this period</p>
                  <p className="mt-1 text-xs text-slate-400 max-w-lg mx-auto">
                    This is an official NERC register entry without connected digital telemetry. Readings are unmeasured and thus excluded from 7-Day Rule breach calculations.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Regulatory footnotes */}
      <div className="rounded-2xl border-2 border-[var(--border-default)] bg-amber-50/60 p-5 text-xs text-slate-700 shadow-[2px_2px_0px_rgba(26,30,41,0.04)]">
        <p className="font-bold text-amber-950">NERC Methodology &amp; Regulatory Principles:</p>
        <p className="mt-1 leading-relaxed">
          Delivered supply hours are derived from continuous 15-minute feeder busbar voltage measurements maintained above 180V. Under NERC Service Accountability orders, days exhibiting under 90% telemetry coverage are categorized as insufficient data and break consecutive failure sequences rather than triggering automatic penalties. Official NERC energy caps are published billing limits, not delivered energy or telemetry.
        </p>
      </div>
    </div>
  );
}
