import { DayBars } from "@/components/DayBars";
import { FeederStatusMark } from "@/components/StatusMark";
import { apiFetch } from "@/lib/api";
import { hours, periodLabel, shortDate } from "@/lib/format";
import { requireRole } from "@/lib/session";
import type { Compliance } from "@/lib/types";

export default async function RegulatorPage() {
  await requireRole("regulator");
  const [period, feeders] = await Promise.all([
    apiFetch<{ start: string; end: string }>("/period"),
    apiFetch<Compliance[]>("/regulator/compliance"),
  ]);
  const breached = feeders.filter((f) => f.status !== "compliant").length;
  const downgrades = feeders.filter((f) => f.downgrade_date).length;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Feeder compliance, {periodLabel(period.start, period.end)}</h1>
          <p className="mt-2 max-w-[68ch] text-ink-2">
            {breached} of {feeders.length} feeders fell short of their Band promise. {downgrades} triggered the 7-Day Rule and
            should be downgraded to the band they actually delivered.
          </p>
        </div>
        <a href="/regulator/export" className="rounded-md bg-ink px-4 py-2.5 font-semibold text-paper hover:opacity-90" download>
          Download evidence (CSV)
        </a>
      </div>

      <ul className="flex flex-col gap-4">
        {feeders.map((f) => (
          <li key={f.feeder_id} className="rounded-lg border border-rule bg-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-xl font-semibold">
                {f.feeder_id} <span className="font-normal text-ink-2">Band {f.band}, {f.committed_hours}h a day promised</span>
              </h2>
              <FeederStatusMark status={f.status} />
            </div>
            <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_340px]">
              <div className="pt-2">
                <DayBars
                  days={f.days.map((d) => ({ date: d.date, value: d.hours, status: d.status }))}
                  max={24}
                  unit="Hours of supply"
                  kind="hours"
                  reference={{ value: f.committed_hours, label: `${f.committed_hours}h` }}
                  height={72}
                  compact
                  caption={`Daily hours of supply on feeder ${f.feeder_id}`}
                />
                <p className="mt-2 flex justify-between text-xs text-muted" aria-hidden>
                  <span>{shortDate(f.days[0].date)}</span>
                  <span>{shortDate(f.days[f.days.length - 1].date)}</span>
                </p>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                <dt className="whitespace-nowrap text-ink-2">Average delivered</dt>
                <dd className="text-right font-medium">{hours(f.average_hours)} a day</dd>
                <dt className="whitespace-nowrap text-ink-2">Days promise kept</dt>
                <dd className="text-right font-medium">
                  {f.days_met} of {f.days_met + f.days_failed}
                  {f.days_insufficient_data > 0 && `, ${f.days_insufficient_data} without data`}
                </dd>
                <dt className="whitespace-nowrap text-ink-2">Explanations owed</dt>
                <dd className="text-right font-medium" title={f.explanation_dates.map(shortDate).join(", ")}>
                  {f.explanation_dates.length || "None"}
                </dd>
                <dt className="whitespace-nowrap text-ink-2">7-Day Rule</dt>
                <dd className="text-right font-medium">
                  {f.downgrade_date ? `Downgrade to Band ${f.recommended_band ?? "below E"} from ${shortDate(f.downgrade_date)}` : "Not triggered"}
                </dd>
                <dt className="whitespace-nowrap text-ink-2">Compensation framework</dt>
                <dd className="text-right font-medium">{f.compensation_flag ? "Customers eligible" : "Not applicable"}</dd>
              </dl>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">
        Hours are counted from 15-minute feeder voltage readings above 180V. Days with under 90% of readings are not judged and break
        any run of failed days.
      </p>
    </div>
  );
}
