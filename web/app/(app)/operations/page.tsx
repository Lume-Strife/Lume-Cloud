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
            </div>
            <h1 id="feeders-heading" className="mt-2 text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              Feeders
            </h1>
            <p className="mt-1.5 text-sm text-[var(--text-muted)]">
              {periodLabel(period.start, period.end)} · Energy sent into each feeder compared with what its meters recorded.
            </p>
          </div>
          <form action={runDetection}>
            <DetectionRunButton />
          </form>
        </div>

        {params.detected && (
          <div role="status" className="mt-4 flex items-center gap-2.5 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3.5 text-xs text-emerald-800 font-medium">
            <svg className="h-4 w-4 shrink-0 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span>Scan finished. Any new leads are in the list below.</span>
          </div>
        )}

        {/* Operational KPI Cards */}
        <div className="mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <div className="rounded-xl border-2 border-[var(--border-strong)] bg-white p-4 shadow-[3px_3px_0px_rgba(26,30,41,0.08)]">
            <span className="text-xs font-medium text-[var(--text-muted)]">Feeders</span>
            <p className="figure mt-2 text-2xl font-bold text-[var(--text-primary)]">{feeders.length}</p>
            <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">{includeUntracked ? "Including NERC register" : "With telemetry"}</span>
          </div>

          <div className="rounded-xl border-2 border-[var(--border-strong)] bg-rose-50 p-4 shadow-[3px_3px_0px_rgba(26,30,41,0.08)]">
            <span className="text-xs font-medium text-rose-700">Unmetered energy</span>
            <p className="figure mt-2 text-2xl font-bold text-rose-700">{kwh(unaccounted)}</p>
            <span className="mt-0.5 block text-[11px] text-rose-700">Above expected technical loss</span>
          </div>

          <div className="rounded-xl border-2 border-[var(--border-strong)] bg-amber-50 p-4 shadow-[3px_3px_0px_rgba(26,30,41,0.08)]">
            <span className="text-xs font-medium text-amber-700">Open leads</span>
            <p className="figure mt-2 text-2xl font-bold text-amber-700">{openCasesCount}</p>
            <span className="mt-0.5 block text-[11px] text-amber-700">Waiting for a site visit</span>
          </div>

          <div className="rounded-xl border-2 border-[var(--border-strong)] bg-sky-50 p-4 shadow-[3px_3px_0px_rgba(26,30,41,0.08)]">
            <span className="text-xs font-medium text-sky-700">Being investigated</span>
            <p className="figure mt-2 text-2xl font-bold text-sky-700">{investigatingCount}</p>
            <span className="mt-0.5 block text-[11px] text-sky-700">Site visit planned</span>
          </div>
        </div>

        {/* Feeder Register Filter */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href={untrackedToggleHref()}
            className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 transition"
          >
            {includeUntracked
              ? "Hide feeders with no telemetry"
              : "Show NERC register feeders with no telemetry"}
          </Link>
        </div>

        {/* Feeders Table: High-Contrast Deliberate Lighter Data Panel */}
        <div className="mt-3 overflow-x-auto rounded-2xl border-2 border-[var(--border-strong)] bg-white shadow-[4px_4px_0px_rgba(26,30,41,0.08)]">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="border-b-2 border-[var(--border-default)] bg-[var(--bg-subtle)] text-xs font-medium text-[var(--text-muted)]">
                <th className="px-5 py-3.5">Feeder</th>
                <th className="px-5 py-3.5">Supply vs promise</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Open leads</th>
                <th className="px-5 py-3.5 text-right">Unmetered energy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {feeders.map((f) => (
                <tr key={f.feeder_id} className="hover:bg-[var(--bg-subtle)] transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--text-primary)]">{f.feeder_id}</span>
                        <TelemetrySourceBadge source={f.feeder_telemetry_source} />
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        Band {f.band} · {f.meters} meters
                        {f.official && ` · ${f.official.disco} (${f.official.state})`}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {f.status === "no_data" ? (
                      <span className="text-[var(--text-muted)]">No telemetry</span>
                    ) : (
                      <>
                        <span className="font-semibold text-[var(--text-primary)]">{hours(f.average_hours)}</span>
                        <span className="text-[var(--text-muted)]"> of {f.committed_hours}h promised</span>
                        <span className="block text-[11px] text-[var(--text-muted)]">{f.days_met} of {f.days_met + f.days_failed} days kept</span>
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
                      <span className="text-[var(--text-muted)]">0</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium">
                    {f.unaccounted_kwh > 0 ? (
                      <span className="font-bold text-rose-700">{kwh(f.unaccounted_kwh)}</span>
                    ) : (
                      <span className="text-[var(--text-muted)]">None</span>
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
            <h2 id="cases-heading" className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Leads to check
            </h2>
            <p className="mt-1 max-w-[70ch] text-sm text-[var(--text-secondary)]">
              Grouped by meter or feeder and sorted by confidence. A lead is a reason to visit the site, not proof of theft.
            </p>
          </div>
          {feeder && (
            <Link
              href={`/operations?status=${filter}#cases`}
              className="rounded-xl border-2 border-[var(--border-default)] bg-white px-3.5 py-1.5 text-xs font-bold text-[var(--text-secondary)] shadow-[2px_2px_0px_rgba(26,30,41,0.06)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition"
            >
              Feeder <strong>{feeder}</strong> only · Show all
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
                    ? "border-2 border-[var(--border-strong)] bg-amber-400 text-[var(--text-primary)] shadow-[2px_2px_0px_rgba(26,30,41,0.12)]"
                    : "border-2 border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] shadow-[2px_2px_0px_rgba(26,30,41,0.04)]"
                }`}
              >
                <span>{s === "all" ? "All" : FLAG_STATUS_LABEL[s]}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isCurrent ? "bg-[var(--text-primary)] text-amber-300" : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
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
            <p className="mt-3 font-bold text-[var(--text-primary)] text-sm">No {filter === "all" ? "" : FLAG_STATUS_LABEL[filter].toLowerCase()} leads</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {feeder ? `Nothing on feeder ${feeder}. Try showing all feeders.` : "Run a scan to check the latest readings."}
            </p>
          </div>
        ) : (
          <ul className="mt-5 divide-y divide-[var(--border-subtle)] rounded-2xl border-2 border-[var(--border-default)] bg-white shadow-[4px_4px_0px_rgba(26,30,41,0.06)]">
            {cases.map((c) => (
              <li key={`${c.subject_type}:${c.subject_id}`}>
                <Link
                  href={caseHref(c)}
                  className="group grid gap-x-6 gap-y-3 px-5 py-4.5 transition-colors hover:bg-[var(--bg-subtle)] md:grid-cols-[160px_1fr_auto] md:items-start"
                >
                  <div className="flex flex-col gap-1.5">
                    <ConfidenceMeter value={c.confidence} />
                    <span className="text-xs text-[var(--text-muted)]">
                      {plural(c.flags.length, "anomaly signal", "anomaly signals")}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Feeder: <strong className="font-semibold text-[var(--text-secondary)]">{c.feeder_id}</strong>
                    </span>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)] group-hover:text-emerald-700 transition-colors">
                      {caseTitle(c)}
                    </p>
                    <ul className="mt-2 flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
                      {c.flags.map((f) => (
                        <li key={f.flag_id} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                          <span>
                            <strong className="font-semibold text-[var(--text-primary)]">{RULE_LABEL[f.rule]}:</strong> {f.reason}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex md:flex-col items-center md:items-end justify-between gap-2">
                    <FlagStatusMark status={c.status} />
                    <span className="text-xs text-[var(--text-muted)] group-hover:text-[var(--text-primary)] font-medium">Open →</span>
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
