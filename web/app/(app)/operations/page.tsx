import Link from "next/link";

import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { DetectionRunButton } from "@/components/DetectionRunButton";
import { FeederStatusMark, FlagStatusMark } from "@/components/StatusMark";
import { TelemetrySourceBadge } from "@/components/TelemetrySourceBadge";
import { apiFetch } from "@/lib/api";
import { caseHref, caseTitle, FLAG_STATUS_LABEL, hours, kwh, periodLabel, plural, RULE_LABEL } from "@/lib/format";
import { requireRole } from "@/lib/session";
import type { Case, FeederOverview, FlagStatus } from "@/lib/types";
import { runDetection } from "../../actions";

const FILTERS: (FlagStatus | "all")[] = ["open", "investigating", "confirmed", "dismissed", "all"];

type PageProps = {
  searchParams: Promise<{
    status?: string;
    feeder?: string;
    include_untracked?: string;
    detected?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function OperationsPage({ searchParams }: PageProps) {
  await requireRole("operations");
  const params = await searchParams;
  const filter = (FILTERS as string[]).includes(String(params.status)) ? (params.status as FlagStatus | "all") : "open";
  const feeder = typeof params.feeder === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(params.feeder) ? params.feeder : null;
  const includeUntracked = params.include_untracked === "true";

  const caseQuery = new URLSearchParams({
    ...(filter !== "all" && { status: filter }),
    ...(feeder && { feeder }),
  }).toString();

  const [period, feeders, cases, allCases] = await Promise.all([
    apiFetch<{ start: string; end: string }>("/period"),
    apiFetch<FeederOverview[]>(`/ops/feeders${includeUntracked ? "?include_untracked=true" : ""}`),
    apiFetch<Case[]>(`/ops/cases${caseQuery ? `?${caseQuery}` : ""}`),
    apiFetch<Case[]>("/ops/cases"),
  ]);

  const unaccounted = feeders.reduce((sum, f) => sum + f.unaccounted_kwh, 0);
  const openCasesCount = allCases.filter((c) => c.status === "open").length;
  const investigatingCount = allCases.filter((c) => c.status === "investigating").length;
  const confirmedCount = allCases.filter((c) => c.status === "confirmed").length;
  const dismissedCount = allCases.filter((c) => c.status === "dismissed").length;

  const countForFilter = (status: FlagStatus | "all") => {
    if (status === "all") return allCases.length;
    if (status === "open") return openCasesCount;
    if (status === "investigating") return investigatingCount;
    if (status === "confirmed") return confirmedCount;
    if (status === "dismissed") return dismissedCount;
    return 0;
  };

  const href = (status: string) => {
    const q = new URLSearchParams({
      ...(status !== "all" && { status }),
      ...(feeder && { feeder }),
      ...(includeUntracked && { include_untracked: "true" }),
    });
    return `/operations?${q.toString()}#cases`;
  };

  const untrackedToggleHref = () => {
    const q = new URLSearchParams({
      ...(filter !== "all" && { status: filter }),
      ...(feeder && { feeder }),
      ...(!includeUntracked && { include_untracked: "true" }),
    });
    return `/operations?${q.toString()}`;
  };

  return (
    <div className="flex flex-col gap-10">
      {/* Top Section: Overview & Feeder Health */}
      <section aria-labelledby="feeders-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="section-pill">Revenue Protection &amp; Operations</span>
              <span className="text-xs text-[var(--text-muted)]">Field Dispatch &amp; Telemetry</span>
            </div>
            <h1 id="feeders-heading" className="mt-2 text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              Feeders &amp; Energy Accounting
            </h1>
            <p className="mt-1.5 text-sm text-[var(--text-muted)]">
              {periodLabel(period.start, period.end)} · Energy balance comparing bulk feeder input against aggregated metered consumption.
            </p>
          </div>
          <form action={runDetection}>
            <DetectionRunButton />
          </form>
        </div>

        {params.detected && (
          <div role="status" className="mt-4 flex items-center gap-2.5 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3.5 text-xs text-emerald-800 font-medium">
            <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span>Theft &amp; anomaly detection engine scan finished. Any new leads have been added to the queue below.</span>
          </div>
        )}

        {/* Operational KPI Cards */}
        <div className="mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <div className="rounded-xl border-2 border-[var(--border-strong)] bg-white p-4 shadow-[3px_3px_0px_rgba(26,30,41,0.08)] transition hover:shadow-[4px_4px_0px_rgba(26,30,41,0.12)]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Tracked Feeders</span>
            <p className="figure mt-2 text-2xl font-bold text-[var(--text-primary)]">{feeders.length}</p>
            <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">{includeUntracked ? "Including NERC register" : "Live telemetry"}</span>
          </div>

          <div className="rounded-xl border-2 border-[var(--border-strong)] bg-rose-50 p-4 shadow-[3px_3px_0px_rgba(26,30,41,0.08)] transition hover:shadow-[4px_4px_0px_rgba(26,30,41,0.12)]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">Unmetered Losses</span>
            <p className="figure mt-2 text-2xl font-bold text-rose-700">{kwh(unaccounted)}</p>
            <span className="mt-0.5 block text-[11px] text-rose-600">Beyond tech loss threshold</span>
          </div>

          <div className="rounded-xl border-2 border-[var(--border-strong)] bg-amber-50 p-4 shadow-[3px_3px_0px_rgba(26,30,41,0.08)] transition hover:shadow-[4px_4px_0px_rgba(26,30,41,0.12)]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Open Leads</span>
            <p className="figure mt-2 text-2xl font-bold text-amber-700">{openCasesCount}</p>
            <span className="mt-0.5 block text-[11px] text-amber-600">Awaiting field inspection</span>
          </div>

          <div className="rounded-xl border-2 border-[var(--border-strong)] bg-sky-50 p-4 shadow-[3px_3px_0px_rgba(26,30,41,0.08)] transition hover:shadow-[4px_4px_0px_rgba(26,30,41,0.12)]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-700">Investigations</span>
            <p className="figure mt-2 text-2xl font-bold text-sky-700">{investigatingCount}</p>
            <span className="mt-0.5 block text-[11px] text-sky-600">Technicians dispatched</span>
          </div>
        </div>

        {/* Feeder Register Filter */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href={untrackedToggleHref()}
            className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 transition"
          >
            {includeUntracked
              ? "← Hide untracked official register feeders"
              : "→ Include untracked NERC register (+21 Kwara Feeders)"}
          </Link>
        </div>

        {/* Feeders Table: High-Contrast Deliberate Lighter Data Panel */}
        <div className="mt-3 overflow-x-auto rounded-2xl border-2 border-[var(--border-strong)] bg-white shadow-[4px_4px_0px_rgba(26,30,41,0.08)]">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="border-b-2 border-[var(--border-default)] bg-[var(--bg-subtle)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                <th className="px-5 py-3.5">Feeder &amp; Telemetry</th>
                <th className="px-5 py-3.5">Supply vs Promise</th>
                <th className="px-5 py-3.5">Band Status</th>
                <th className="px-5 py-3.5 text-right">Field Leads</th>
                <th className="px-5 py-3.5 text-right">Unaccounted Energy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {feeders.map((f) => (
                <tr key={f.feeder_id} className="hover:bg-[var(--bg-subtle)] transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{f.feeder_id}</span>
                        <TelemetrySourceBadge source={f.feeder_telemetry_source} />
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Band {f.band} · {f.meters} connected meters
                        {f.official && ` · ${f.official.disco} (${f.official.state})`}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {f.status === "no_data" ? (
                      <span className="text-slate-400">No telemetry data</span>
                    ) : (
                      <>
                        <span className="font-semibold text-slate-900">{hours(f.average_hours)}</span>
                        <span className="text-slate-500"> of {f.committed_hours}h/day commitment</span>
                        <span className="block text-[11px] text-slate-400">{f.days_met} of {f.days_met + f.days_failed} days achieved</span>
                      </>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <FeederStatusMark status={f.status} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {f.open_cases > 0 ? (
                      <Link
                        href={`/operations?status=open&feeder=${f.feeder_id}#cases`}
                        className="inline-flex items-center gap-1 font-bold text-amber-700 hover:underline"
                      >
                        <span>{f.open_cases} open</span>
                        <span aria-hidden>→</span>
                      </Link>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium">
                    {f.unaccounted_kwh > 0 ? (
                      <span className="font-bold text-rose-600">{kwh(f.unaccounted_kwh)}</span>
                    ) : (
                      <span className="text-slate-400">None detected</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bottom Section: Theft and Fraud Cases Queue */}
      <section aria-labelledby="cases-heading" id="cases">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h2 id="cases-heading" className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
              Theft &amp; Tamper Leads Queue
            </h2>
            <p className="mt-1 max-w-[70ch] text-sm text-[var(--text-secondary)]">
              Leads aggregated by meter or feeder and ranked by algorithmic confidence. A case is a lead for physical on-site inspection, not proof. Record findings before deciding.
            </p>
          </div>
          {feeder && (
            <Link
              href={`/operations?status=${filter}#cases`}
              className="rounded-xl border-2 border-[var(--border-default)] bg-white px-3.5 py-1.5 text-xs font-bold text-[var(--text-secondary)] shadow-[2px_2px_0px_rgba(26,30,41,0.06)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition"
            >
              Filtered by feeder <strong>{feeder}</strong> · Show all
            </Link>
          )}
        </div>

        {/* Case Filter Tabs with Counts */}
        <nav aria-label="Filter cases" className="mt-5 flex flex-wrap items-center gap-2 border-b-2 border-[var(--border-default)] pb-3">
          {FILTERS.map((s) => {
            const count = countForFilter(s);
            const isCurrent = filter === s;
            return (
              <Link
                key={s}
                href={href(s)}
                aria-current={isCurrent ? "page" : undefined}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  isCurrent
                    ? "border-2 border-slate-900 bg-amber-400 text-slate-950 shadow-[2px_2px_0px_rgba(26,30,41,0.12)]"
                    : "border-2 border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] shadow-[2px_2px_0px_rgba(26,30,41,0.04)]"
                }`}
              >
                <span>{s === "all" ? "All Cases" : FLAG_STATUS_LABEL[s]}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    isCurrent ? "bg-slate-900 text-amber-300" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Cases List */}
        {cases.length === 0 ? (
          <div className="mt-6 rounded-2xl border-2 border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] p-12 text-center text-[var(--text-secondary)]">
            <svg className="mx-auto h-8 w-8 text-[var(--text-muted)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-3 font-bold text-[var(--text-primary)] text-sm">No {filter === "all" ? "" : FLAG_STATUS_LABEL[filter].toLowerCase()} cases found</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {feeder ? `No cases match feeder ${feeder}. Try clearing the feeder filter.` : "Scan for leads to analyze current readings."}
            </p>
          </div>
        ) : (
          <ul className="mt-5 divide-y divide-slate-100 rounded-2xl border-2 border-[var(--border-default)] bg-white shadow-[4px_4px_0px_rgba(26,30,41,0.06)]">
            {cases.map((c) => (
              <li key={`${c.subject_type}:${c.subject_id}`}>
                <Link
                  href={caseHref(c)}
                  className="group grid gap-x-6 gap-y-3 px-5 py-4.5 transition-colors hover:bg-slate-50/70 md:grid-cols-[160px_1fr_auto] md:items-start"
                >
                  <div className="flex flex-col gap-1.5">
                    <ConfidenceMeter value={c.confidence} />
                    <span className="text-xs text-slate-500">
                      {plural(c.flags.length, "anomaly signal", "anomaly signals")}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Feeder: <strong className="font-semibold text-slate-700">{c.feeder_id}</strong>
                    </span>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      {caseTitle(c)}
                    </p>
                    <ul className="mt-2 flex flex-col gap-1 text-xs text-slate-600">
                      {c.flags.map((f) => (
                        <li key={f.flag_id} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                          <span>
                            <strong className="font-semibold text-slate-900">{RULE_LABEL[f.rule]}:</strong> {f.reason}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex md:flex-col items-center md:items-end justify-between gap-2">
                    <FlagStatusMark status={c.status} />
                    <span className="text-xs text-slate-400 group-hover:text-slate-900 font-medium">Review case →</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
