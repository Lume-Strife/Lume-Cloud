import Link from "next/link";

import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { FeederStatusMark, FlagStatusMark } from "@/components/StatusMark";
import { apiFetch } from "@/lib/api";
import { caseHref, caseTitle, FLAG_STATUS_LABEL, hours, kwh, periodLabel, plural, RULE_LABEL } from "@/lib/format";
import { requireRole } from "@/lib/session";
import type { Case, FeederOverview, FlagStatus } from "@/lib/types";

import { runDetection } from "../../actions";

const FILTERS: (FlagStatus | "all")[] = ["open", "investigating", "confirmed", "dismissed", "all"];

export default async function OperationsPage({ searchParams }: PageProps<"/operations">) {
  await requireRole("operations");
  const params = await searchParams;
  const filter = (FILTERS as string[]).includes(String(params.status)) ? (params.status as FlagStatus | "all") : "open";
  const feeder = typeof params.feeder === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(params.feeder) ? params.feeder : null;
  const query = new URLSearchParams({ ...(filter !== "all" && { status: filter }), ...(feeder && { feeder }) }).toString();
  const href = (status: string) => `/operations?status=${status}${feeder ? `&feeder=${feeder}` : ""}#cases`;
  const [period, feeders, cases] = await Promise.all([
    apiFetch<{ start: string; end: string }>("/period"),
    apiFetch<FeederOverview[]>("/ops/feeders"),
    apiFetch<Case[]>(`/ops/cases${query ? `?${query}` : ""}`),
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
              Check for new cases
            </button>
          </form>
        </div>
        {params.detected && <p role="status" className="mt-4 border-l-4 border-met pl-3 text-sm">Detection finished. Any new cases are in the queue below.</p>}
        <div className="mt-6 overflow-x-auto rounded-lg border border-rule bg-surface">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-rule text-sm text-muted">
                <th className="px-4 py-3 font-medium">Feeder</th>
                <th className="px-4 py-3 font-medium">Supply vs promise</th>
                <th className="px-4 py-3 font-medium">Band status</th>
                <th className="px-4 py-3 text-right font-medium">Open cases</th>
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
                    <Link href={`/operations?status=open&feeder=${f.feeder_id}#cases`} className="underline underline-offset-2">{f.open_cases}</Link>
                  </td>
                  <td className="px-4 py-3 text-right">{f.unaccounted_kwh > 0 ? kwh(f.unaccounted_kwh) : "None found"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="cases-heading" id="cases">
        <h2 id="cases-heading" className="text-3xl font-semibold">Theft and tamper leads</h2>
        <p className="mt-1 max-w-[68ch] text-ink-2">
          One case per meter or feeder, strongest evidence first. A case is a reason to visit, not proof. Record what you find
          on site before confirming.
        </p>
        <nav aria-label="Filter cases" className="mt-5 flex flex-wrap gap-1 text-sm">
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
            <Link href={`/operations?status=${filter}#cases`} className="ml-2 px-3 py-1.5 text-ink-2 underline underline-offset-2">
              Showing {feeder} only. Show all feeders
            </Link>
          )}
        </nav>
        {cases.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-rule-strong p-6 text-ink-2">
            No {filter === "all" ? "" : FLAG_STATUS_LABEL[filter].toLowerCase()} cases. Run a check to look for new ones.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-rule rounded-lg border border-rule bg-surface">
            {cases.map((c) => (
              <li key={`${c.subject_type}:${c.subject_id}`}>
                <Link
                  href={caseHref(c)}
                  className="grid gap-x-6 gap-y-2 px-4 py-4 hover:bg-paper md:grid-cols-[140px_1fr_auto] md:items-start"
                >
                  <div className="flex flex-col gap-1">
                    <ConfidenceMeter value={c.confidence} />
                    <span className="text-xs text-muted">{plural(c.flags.length, "signal", "signals")}</span>
                  </div>
                  <div>
                    <p className="font-semibold">{caseTitle(c)}</p>
                    <ul className="mt-1 flex flex-col gap-0.5 text-sm text-ink-2">
                      {c.flags.map((f) => (
                        <li key={f.flag_id}>
                          <span className="font-medium text-ink">{RULE_LABEL[f.rule]}.</span> {f.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <FlagStatusMark status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
