import { DayBars } from "@/components/DayBars";
import { FeederStatusMark } from "@/components/StatusMark";
import { apiFetch } from "@/lib/api";
import { kwh, money, periodLabel, plural } from "@/lib/format";
import { requireRole } from "@/lib/session";
import type { CustomerSummary } from "@/lib/types";

function supplyExplanation(s: CustomerSummary["supply"]) {
  if (s.status === "downgrade")
    return `Your feeder missed its Band ${s.band} promise 7 days in a row. Under the NERC 7-Day Rule it should be moved to the band it actually delivered, and you should pay that band's lower tariff.`;
  if (s.status === "at_risk")
    return `Your feeder fell short of the ${s.committed_hours} hours a day Band ${s.band} promises on ${s.days_failed} days.`;
  return `Your feeder kept its Band ${s.band} promise.`;
}

export default async function CustomerPage() {
  await requireRole("customer");
  const data = await apiFetch<CustomerSummary>("/customer/summary");
  const { supply, bill, daily } = data;
  const period = periodLabel(data.period.start, data.period.end);
  const credit = bill.recommendations.find((r) => r.type === "downgrade_credit");
  const others = bill.recommendations.filter((r) => r.type !== "downgrade_credit");
  const q = bill.data_quality;

  return (
    <div className="flex flex-col gap-14">
      <section aria-labelledby="supply-heading">
        <h1 id="supply-heading" className="text-lg font-semibold text-ink-2">
          Power at meter {data.meter_id}, {period}
        </h1>
        <div className="mt-6 flex flex-wrap items-end gap-x-14 gap-y-6">
          <div>
            <p className="figure text-6xl md:text-8xl">{supply.average_hours.toFixed(1)}</p>
            <p className="mt-2 text-ink-2">hours a day delivered, on average</p>
          </div>
          <div>
            <p className="figure text-6xl text-muted md:text-8xl">{supply.committed_hours}</p>
            <p className="mt-2 text-ink-2">hours a day promised by Band {supply.band}</p>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-2 md:max-w-[68ch]">
          <FeederStatusMark status={supply.status} />
          <p className="text-ink-2">{supplyExplanation(supply)}</p>
        </div>
        <div className="mt-8 rounded-lg border border-rule bg-surface p-4 md:p-6">
          <p className="mb-6 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-2">
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-met" />Promise kept, {plural(supply.days_met, "day", "days")}</span>
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-breach" />Promise missed, {plural(supply.days_failed, "day", "days")}</span>
            {supply.days_insufficient_data > 0 && (
              <span className="inline-flex items-center gap-2"><span className="hatch h-3 w-3 rounded-sm" />Not enough data, {plural(supply.days_insufficient_data, "day", "days")}</span>
            )}
          </p>
          <DayBars
            days={daily.map((d) => ({ date: d.date, value: d.supply_hours, status: d.status }))}
            max={24}
            unit="Hours of supply"
            kind="hours"
            reference={{ value: supply.committed_hours, label: `Band ${supply.band} promise: ${supply.committed_hours}h` }}
            caption={`Hours of supply each day, ${period}`}
          />

        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="bill-heading">
          <h2 id="bill-heading" className="text-2xl font-semibold">Your bill for {period}</h2>
          <table className="mt-4 w-full text-left">
            <thead>
              <tr className="border-b border-rule-strong text-sm text-muted">
                <th className="py-2 pr-3 font-medium">Charge</th>
                <th className="py-2 pr-3 text-right font-medium">Energy</th>
                <th className="hidden py-2 pr-3 text-right font-medium sm:table-cell">Rate</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill.lines.map((l) => (
                <tr key={l.description} className="border-b border-rule align-top">
                  <td className="py-3 pr-3">
                    {l.estimated ? "Estimated energy" : "Metered energy"}
                    {l.estimated && <span className="block text-sm text-muted">for readings that didn&apos;t arrive while your feeder had power</span>}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-3 text-right">{kwh(l.kwh)}</td>
                  <td className="hidden whitespace-nowrap py-3 pr-3 text-right sm:table-cell">{money(l.rate)}/kWh</td>
                  <td className="whitespace-nowrap py-3 text-right">{money(l.amount)}</td>
                </tr>
              ))}
              <tr className="border-b border-rule">
                <td className="py-3" colSpan={2}>VAT</td>
                <td className="hidden sm:table-cell" />
                <td className="py-3 text-right">{money(bill.vat)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-4 text-lg font-semibold" colSpan={2}>Total</td>
                <td className="hidden sm:table-cell" />
                <td className="figure whitespace-nowrap pt-4 text-right text-2xl sm:text-3xl">{money(bill.total)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-6 text-sm text-ink-2">
            {q.metered_slots.toLocaleString()} of {plural(q.expected_slots, "meter reading", "meter readings")} arrived.
            {q.estimated_slots > 0 &&
              ` ${q.estimated_slots} ${q.estimated_slots === 1 ? "was" : "were"} estimated because your feeder had power at the time.`}
            {q.unbilled_unknown_slots > 0 &&
              ` ${q.unbilled_unknown_slots} ${q.unbilled_unknown_slots === 1 ? "was" : "were"} not billed because nobody can confirm you had power then.`}
          </p>
        </section>

        <section aria-labelledby="owed-heading" className="rounded-lg border border-rule bg-surface p-6 self-start">
          <h2 id="owed-heading" className="text-2xl font-semibold">What you may be owed</h2>
          {credit ? (
            <>
              <p className="figure mt-5 text-4xl text-met sm:text-5xl">{money(credit.amount!)}</p>
              <p className="mt-3 text-ink-2">
                Credit if the 7-Day Rule downgrade is applied to energy you used after your feeder was due to move band.
              </p>
            </>
          ) : (
            <p className="mt-4 text-ink-2">Nothing this period. Your feeder did not trigger a downgrade.</p>
          )}
          {others.map((r) => (
            <p key={r.type} className="mt-4 border-t border-rule pt-4 text-ink-2">
              {r.type === "compensation_review"
                ? "Your feeder's average was below its Band promise, so you may also qualify under the NERC compensation framework."
                : r.description}
            </p>
          ))}
          <p className="mt-6 text-sm text-muted">These are recommendations. They are not yet applied to your bill and need your DisCo to review them.</p>
        </section>
      </div>

      <section aria-labelledby="usage-heading">
        <h2 id="usage-heading" className="text-2xl font-semibold">Energy you used each day</h2>
        <p className="mt-1 text-ink-2">Days with fewer hours of supply usually show lower use.</p>
        <div className="mt-6 rounded-lg border border-rule bg-surface p-4 md:p-6">
          <DayBars
            days={daily.map((d) => ({ date: d.date, value: d.kwh }))}
            max={Math.max(...daily.map((d) => d.kwh), 1) * 1.1}
            unit="Energy used"
            kind="kwh"
            height={160}
            caption={`Energy used each day, ${period}`}
          />
        </div>
      </section>
    </div>
  );
}
