import Link from "next/link";

import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { FeederStatusMark, FlagStatusMark } from "@/components/StatusMark";
import { apiFetch } from "@/lib/api";
import { FLAG_STATUS_LABEL, hours, kwh, periodLabel, RULE_LABEL } from "@/lib/format";
import { requireRole } from "@/lib/session";
import type { FeederOverview, Flag, FlagStatus } from "@/lib/types";

import { runDetection } from "../../actions";

const FILTERS: (FlagStatus | "all")[] = ["open", "investigating", "confirmed", "dismissed", "all"];

export default async function OperationsPage({ searchParams }: PageProps<"/operations">) {
  await requireRole("operations");
  const params = await searchParams;
  const filter = (FILTERS as string[]).includes(String(params.status)) ? (params.status as FlagStatus | "all") : "open";
  const feeder = typeof params.feeder === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(params.feeder) ? params.feeder : null;
  const query = new URLSearchParams({ ...(filter !== "all" && { status: filter }), ...(feeder && { feeder }) }).toString();
  const href = (status: string) => `/operations?status=${status}${feeder ? `&feeder=${feeder}` : ""}#flags`;
  const [period, feeders, flags] = await Promise.all([
    apiFetch<{ start: string; end: string }>("/period"),
    apiFetch<FeederOverview[]>("/ops/feeders"),
    apiFetch<Flag[]>(`/ops/flags${query ? `?${query}` : ""}`),
  ]);
  const unaccounted = feeders.reduce((sum, f) => sum + f.unaccounted_kwh, 0);

  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="feeders-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 id="feeders-heading" className="text-3xl font-semibold">Feeders</h1>
            <p className="mt-1 text-ink-2">
              {periodLabel(period.start, period.end)}. {kwh(unaccounted)} entered these feeders but was never metered.
            </p>
          </div>
          <form action={runDetection}>
            <button type="submit" className="rounded-md border border-rule-strong bg-surface px-4 py-2 font-medium hover:bg-paper">
              Check for new flags
            </button>
          </form>
        </div>
        {params.detected && <p role="status" className="mt-4 border-l-4 border-met pl-3 text-sm">Detection finished. New flags are in the queue below.</p>}
        <div className="mt-6 overflow-x-auto rounded-lg border border-rule bg-surface">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-rule text-sm text-muted">
                <th className="px-4 py-3 font-medium">Feeder</th>
                <th className="px-4 py-3 font-medium">Supply vs promise</th>
                <th className="px-4 py-3 font-medium">Band status</th>
                <th className="px-4 py-3 text-right font-medium">Open flags</th>
                <th className="px-4 py-3 text-right font-medium">Unmetered energy</th>
              </tr>
            </thead>
            <tbody>
              {feeders.map((f) => (
                <tr key={f.feeder_id} className="border-b border-rule last:border-0">
                  <td className="px-4 py-3">
                    <span className="font-semibold">{f.feeder_id}</span>
                    <span className="block text-sm text-muted">Band {f.band}, {f.meters} meters</span>
                  </td>
                  <td className="px-4 py-3">
                    {hours(f.average_hours)} of {f.committed_hours}h a day
                    <span className="block text-sm text-muted">{f.days_met} of {f.days_met + f.days_failed} days kept</span>
                  </td>
                  <td className="px-4 py-3"><FeederStatusMark status={f.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/operations?status=open&feeder=${f.feeder_id}#flags`} className="underline underline-offset-2">{f.open_flags}</Link>
                  </td>
                  <td className="px-4 py-3 text-right">{f.unaccounted_kwh > 0 ? kwh(f.unaccounted_kwh) : "None found"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="flags-heading" id="flags">
        <h2 id="flags-heading" className="text-3xl font-semibold">Theft and tamper leads</h2>
        <p className="mt-1 max-w-[68ch] text-ink-2">
          Strongest evidence first. A flag is a reason to look, not proof. Record what you find on site before confirming.
        </p>
        <nav aria-label="Filter flags" className="mt-5 flex flex-wrap gap-1 text-sm">
          {FILTERS.map((s) => (
            <Link
              key={s}
              href={href(s)}
              aria-current={filter === s ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 font-medium ${filter === s ? "bg-ink text-paper" : "border border-rule-strong text-ink-2 hover:text-ink"}`}
            >
              {s === "all" ? "All" : FLAG_STATUS_LABEL[s]}
            </Link>
          ))}
          {feeder && (
            <Link href={`/operations?status=${filter}#flags`} className="ml-2 px-3 py-1.5 text-ink-2 underline underline-offset-2">
              Showing {feeder} only. Show all feeders
            </Link>
          )}
        </nav>
        {flags.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-rule-strong p-6 text-ink-2">
            No {filter === "all" ? "" : FLAG_STATUS_LABEL[filter].toLowerCase()} flags. Run a check to look for new ones.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-rule rounded-lg border border-rule bg-surface">
            {flags.map((f) => (
              <li key={f.flag_id}>
                <Link
                  href={`/operations/flags/${f.flag_id}`}
                  className="grid gap-x-6 gap-y-2 px-4 py-4 hover:bg-paper md:grid-cols-[120px_1fr_auto] md:items-center"
                >
                  <ConfidenceMeter value={f.confidence} />
                  <div>
                    <p className="font-semibold">
                      {RULE_LABEL[f.rule]}{" "}
                      <span className="font-normal text-ink-2">
                        {f.subject_type === "meter" ? `meter ${f.subject_id} on ${f.feeder_id}` : f.subject_id}
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm text-ink-2">{f.reason}</p>
                  </div>
                  <FlagStatusMark status={f.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
