import { DayBars } from "@/components/DayBars";
import { FeederStatusMark } from "@/components/StatusMark";
import { CustomerDisputeModal } from "@/components/CustomerDisputeModal";
import { TelemetrySourceBadge } from "@/components/TelemetrySourceBadge";
import { apiFetch } from "@/lib/api";
import { kwh, money, periodLabel, plural } from "@/lib/format";
import { requireRole } from "@/lib/session";
import type { CustomerSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

function supplyExplanation(s: CustomerSummary["supply"]) {
  if (s.status === "downgrade")
    return `Your feeder missed its Band ${s.band} promise 7 days in a row. Under the NERC 7-Day Rule, your feeder should be downgraded to the band it actually delivers, and you may be owed a credit.`;
  if (s.status === "at_risk")
    return `Your feeder delivered an average of ${s.average_hours.toFixed(1)}h/day, short of the ${s.committed_hours} hours promised by Band ${s.band} on ${s.days_failed} days.`;
  return `Your feeder kept its Band ${s.band} promise, averaging ${s.average_hours.toFixed(1)} hours of supply per day.`;
}

export default async function CustomerPage() {
  await requireRole("customer");
  const data = await apiFetch<CustomerSummary>("/customer/summary");
  const { supply, bill, daily } = data;
  const period = periodLabel(data.period.start, data.period.end);
  const credit = bill.recommendations.find((r) => r.type === "downgrade_credit");
  const others = bill.recommendations.filter((r) => r.type !== "downgrade_credit");
  const q = bill.data_quality;

  const fulfillmentRate = Math.min(100, Math.round((supply.average_hours / supply.committed_hours) * 100));

  return (
    <div className="flex flex-col gap-10">
      {/* Top Header & Context */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[var(--border-default)] pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <TelemetrySourceBadge source="simulated" />
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Meter {data.meter_id}
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Feeder <strong className="font-semibold text-[var(--text-secondary)]">{bill.feeder_id}</strong> · Band {supply.band}, {supply.committed_hours}h a day promised · {period}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <CustomerDisputeModal data={data} periodText={period} />
        </div>
      </div>

      {/* Hero Section: Supply Delivered vs Band Commitment */}
      <section aria-labelledby="supply-heading" className="rounded-2xl border-2 border-[var(--border-strong)] bg-white p-4 sm:p-8 shadow-[4px_4px_0px_rgba(26,30,41,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="supply-heading" className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Supply vs your Band {supply.band} promise
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)] max-w-[65ch]">
              Hours of power your feeder delivered each day, measured from its voltage.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FeederStatusMark status={supply.status} />
          </div>
        </div>

        {/* Big Numbers & Compliance Progress */}
        {/* Three across even on phones: short labels and smaller figures below sm. */}
        <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3 sm:p-5">
            <span className="text-[11px] font-medium text-[var(--text-muted)] sm:text-xs">
              <span className="sm:hidden">Average</span>
              <span className="hidden sm:inline">Average per day</span>
            </span>
            <div className="mt-1.5 flex flex-col sm:mt-2 sm:flex-row sm:items-baseline sm:gap-2">
              <span className="figure text-3xl font-bold text-[var(--text-primary)] sm:text-5xl">{supply.average_hours.toFixed(1)}</span>
              <span className="text-xs font-semibold text-[var(--text-muted)] sm:text-sm">hours / day</span>
            </div>
            <span className="mt-1 hidden text-[11px] text-[var(--text-muted)] sm:block">From 15-minute voltage readings</span>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3 sm:p-5">
            <span className="text-[11px] font-medium text-[var(--text-muted)] sm:text-xs">
              <span className="sm:hidden">Promised</span>
              <span className="hidden sm:inline">Band {supply.band} promise</span>
            </span>
            <div className="mt-1.5 flex flex-col sm:mt-2 sm:flex-row sm:items-baseline sm:gap-2">
              <span className="figure text-3xl font-bold text-[var(--text-muted)] sm:text-5xl">{supply.committed_hours}</span>
              <span className="text-xs font-semibold text-[var(--text-muted)] sm:text-sm">hours / day</span>
            </div>
            <span className="mt-1 hidden text-[11px] text-[var(--text-muted)] sm:block">Set by your tariff band</span>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3 sm:p-5">
            <span className="text-[11px] font-medium text-[var(--text-muted)] sm:text-xs">
              <span className="sm:hidden">Of promise</span>
              <span className="hidden sm:inline">Hours delivered vs promised</span>
            </span>
            <div className="mt-1.5 sm:mt-2">
              <span className={`figure text-3xl font-bold sm:text-5xl ${fulfillmentRate >= 100 ? "text-emerald-700" : fulfillmentRate >= 75 ? "text-amber-700" : "text-rose-700"}`}>
                {fulfillmentRate}%
              </span>
            </div>
            <span className="mt-1 block text-[11px] text-[var(--text-muted)]">
              {supply.days_met} of {supply.days_met + supply.days_failed} days kept
            </span>
          </div>
        </div>

        {/* Status Callout Banner */}
        <div className={`mt-5 rounded-xl border p-4 text-xs ${
          supply.status === "downgrade"
            ? "border-rose-200 bg-rose-50 text-rose-800"
            : supply.status === "at_risk"
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-emerald-200 bg-emerald-50 text-emerald-800"
        }`}>
          <div className="flex items-start gap-2.5">
            <div>
              <p className="font-semibold text-sm">{supplyExplanation(supply)}</p>
              {supply.status === "downgrade" && (
                <p className="mt-0.5 text-xs opacity-90">
                  The recommended credit is shown next to your bill.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Daily Supply Hours Chart */}
        <div className="mt-7 border-t border-[var(--border-subtle)] pt-5">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Hours of power each day</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-xs bg-emerald-500" /> Kept ({plural(supply.days_met, "day", "days")})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-xs bg-rose-500" /> Missed ({plural(supply.days_failed, "day", "days")})
              </span>
              {supply.days_insufficient_data > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="hatch h-2 w-2 rounded-xs" /> Gap ({plural(supply.days_insufficient_data, "day", "days")})
                </span>
              )}
            </div>
          </div>

          <DayBars
            days={daily.map((d) => ({ date: d.date, value: d.supply_hours, status: d.status }))}
            max={24}
            unit="Hours of supply"
            kind="hours"
            reference={{ value: supply.committed_hours, label: `Band ${supply.band}: ${supply.committed_hours}h` }}
            caption={`Hours of supply each day on feeder ${bill.feeder_id}, ${period}`}
          />
        </div>
      </section>

      {/* Bill & Recommendations Grid */}
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Bill Breakdown */}
        <section aria-labelledby="bill-heading" className="rounded-2xl border-2 border-[var(--border-strong)] bg-white p-4 sm:p-7 shadow-[4px_4px_0px_rgba(26,30,41,0.08)]">
          <div className="flex items-baseline justify-between border-b border-[var(--border-subtle)] pb-3">
            <h2 id="bill-heading" className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Your bill
            </h2>
            <span className="text-xs text-[var(--text-muted)]">Tariff {bill.tariff_version}</span>
          </div>

          <table className="mt-3.5 w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-xs font-medium text-[var(--text-muted)]">
                <th className="py-2.5 pr-3">Item</th>
                <th className="hidden py-2.5 pr-3 text-right sm:table-cell">Energy</th>
                <th className="hidden py-2.5 pr-3 text-right sm:table-cell">Rate</th>
                <th className="py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-xs">
              {bill.lines.map((l) => (
                <tr key={l.description} className="align-top">
                  <td className="py-3 pr-3">
                    <span className="font-semibold text-[var(--text-primary)]">{l.estimated ? "Estimated energy" : "Metered energy"}</span>
                    {/* Phones have no Energy column, so the amount of energy sits under the name. */}
                    <span className="block font-medium text-[var(--text-secondary)] sm:hidden">
                      {kwh(l.kwh)} at {money(l.rate)}/kWh
                    </span>
                    {l.estimated ? (
                      <span className="block text-[11px] text-[var(--text-muted)] mt-0.5">
                        For times your meter was offline but the feeder had power.
                      </span>
                    ) : (
                      <span className="block text-[11px] text-[var(--text-muted)] mt-0.5">
                        Read by your meter.
                      </span>
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap py-3 pr-3 text-right font-medium text-[var(--text-primary)] sm:table-cell">{kwh(l.kwh)}</td>
                  <td className="hidden whitespace-nowrap py-3 pr-3 text-right text-[var(--text-muted)] sm:table-cell">{money(l.rate)}/kWh</td>
                  <td className="whitespace-nowrap py-3 text-right font-bold text-[var(--text-primary)]">{money(l.amount)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-3 pr-3 text-[var(--text-secondary)]">VAT (7.5%)</td>
                <td className="hidden sm:table-cell" colSpan={2} />
                <td className="whitespace-nowrap py-3 text-right font-medium text-[var(--text-secondary)]">{money(bill.vat)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--border-strong)]">
                <td className="pt-3.5 text-base font-bold text-[var(--text-primary)]">Total</td>
                <td className="hidden sm:table-cell" colSpan={2} />
                <td className="figure whitespace-nowrap pt-3.5 text-right text-2xl font-bold text-[var(--text-primary)]">{money(bill.total)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Supply-Backed Estimation Transparency */}
          <div className="mt-5 rounded-xl bg-[var(--bg-subtle)] p-3.5 text-xs text-[var(--text-secondary)] border border-[var(--border-subtle)]">
            <p className="font-semibold text-[var(--text-primary)]">How this bill was worked out</p>
            <p className="mt-0.5 text-[11px] leading-relaxed">
              Of {plural(q.expected_slots, "expected telemetry interval", "expected telemetry intervals")}, {q.metered_slots.toLocaleString()} arrived from your meter.
              {q.estimated_slots > 0 &&
                ` ${plural(q.estimated_slots, "missing interval was", "missing intervals were")} estimated because feeder logs proved power was present.`}
              {q.unbilled_unknown_slots > 0 &&
                ` ${plural(q.unbilled_unknown_slots, "interval was", "intervals were")} not billed because supply could not be verified by feeder data.`}
            </p>
          </div>
        </section>

        {/* What You May Be Owed: Downgrade Credit & Compensation */}
        <section aria-labelledby="owed-heading" className="self-start rounded-2xl border-2 border-[var(--border-strong)] bg-white p-4 sm:p-7 shadow-[4px_4px_0px_rgba(26,30,41,0.08)]">
          <div className="border-b border-[var(--border-subtle)] pb-3">
            <h2 id="owed-heading" className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              What you may be owed
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">Under the 7-Day Rule and NERC compensation rules</p>
          </div>

          {credit ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
              <span className="text-xs font-medium text-emerald-700">Recommended credit</span>
              <p className="figure mt-1.5 text-3xl font-bold text-emerald-700 sm:text-4xl">{money(credit.amount!)}</p>
              <p className="mt-2 text-xs leading-relaxed text-emerald-900">
                Your feeder missed its Band {supply.band} promise 7 days in a row, so energy used after that should be billed at the lower band&apos;s tariff. This is the difference.
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4 text-xs text-[var(--text-secondary)]">
              <p className="font-semibold text-[var(--text-primary)]">No credit due</p>
              <p className="mt-0.5 text-[var(--text-muted)]">
                Your feeder didn&apos;t miss its promise 7 days in a row this month.
              </p>
            </div>
          )}

          {others.length > 0 && (
            <div className="mt-3.5 flex flex-col gap-2.5">
              {others.map((r) => (
                <div key={r.type} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3.5 text-xs text-[var(--text-secondary)]">
                  <p className="font-semibold text-[var(--text-primary)]">
                    {r.type === "compensation_review" ? "Compensation review" : r.type}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    {r.type === "compensation_review"
                      ? "Your feeder's average supply fell below its band promise, so you may be due compensation under NERC's compensation framework."
                      : r.description}
                  </p>
                </div>
              ))}
            </div>
          )}

          <p className="mt-5 text-[11px] leading-relaxed text-[var(--text-muted)]">
            These amounts are worked out from the readings. Your DisCo still has to review and apply them.
          </p>
        </section>
      </div>

      {/* Customer Daily Consumption Profile */}
      <section aria-labelledby="usage-heading" className="rounded-2xl border-2 border-[var(--border-strong)] bg-white p-4 sm:p-7 shadow-[4px_4px_0px_rgba(26,30,41,0.08)]">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h2 id="usage-heading" className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Energy you used each day
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Compare this with the hours of power above. A sudden change can point to a meter problem.
            </p>
          </div>
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Total: {kwh(daily.reduce((sum, d) => sum + d.kwh, 0))}</span>
        </div>

        <div className="mt-5">
          <DayBars
            days={daily.map((d) => ({ date: d.date, value: d.kwh }))}
            max={Math.max(...daily.map((d) => d.kwh), 1) * 1.15}
            unit="Energy used"
            kind="kwh"
            height={160}
            caption={`Energy used each day by meter ${data.meter_id}, ${period}`}
          />
        </div>
      </section>
    </div>
  );
}
