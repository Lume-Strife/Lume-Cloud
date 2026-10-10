"use client";

import { useState } from "react";
import type { AuditEntry } from "@/lib/types";
import { periodLabel, when } from "@/lib/format";

const ACTION_LABEL: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.login_failed": "Failed sign-in",
  "auth.logout": "Signed out",
  "flag.decide": "Decided a flag",
  "case.decide": "Decided a case",
  "meter.view": "Viewed meter data",
  "report.export": "Exported compliance report",
  "detection.run": "Ran a scan",
  "demo.seed": "Created demo data",
};

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "decisions", label: "Decisions", filter: (a: string) => a.includes("decide") },
  { id: "detection", label: "Scans", filter: (a: string) => a.includes("detection") },
  { id: "views", label: "Views and exports", filter: (a: string) => a.includes("view") || a.includes("export") },
  { id: "auth", label: "Sign-ins", filter: (a: string) => a.startsWith("auth") },
];

function detail(e: AuditEntry) {
  const d = e.details as Record<string, string | number>;
  if (e.action === "case.decide") {
    const subject = e.target.replace(/^(meter|feeder):/, (_, t: string) => (t === "meter" ? "Meter " : "Feeder "));
    return `${subject}: ${d.from} → ${d.to}${d.note ? `, “${d.note}”` : ""}`;
  }
  if (e.action === "flag.decide") return `${d.subject}: ${d.from} → ${d.to}${d.note ? `, “${d.note}”` : ""}`;
  if (e.action === "detection.run") return `${d.flags_found} flags found, ${d.flags_created} new`;
  if (e.action === "demo.seed") return "Fresh demo database";
  if (e.action === "meter.view") return `Meter ${e.target.replace(/^meter:/, "")}, ${periodLabel(String(d.from), String(d.to))}`;
  if (e.action === "report.export") return `Compliance report, ${periodLabel(String(d.from), String(d.to))}`;
  if (e.action.startsWith("auth")) return d.ip ? `from ${d.ip}` : "";
  return e.target;
}

export function AuditLogViewer({ entries }: { entries: AuditEntry[] }) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = entries.filter((e) => {
    if (activeCategory !== "all") {
      const cat = CATEGORIES.find((c) => c.id === activeCategory);
      if (cat?.filter && !cat.filter(e.action)) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchActor = e.actor.toLowerCase().includes(q);
      const matchAction = (ACTION_LABEL[e.action] ?? e.action).toLowerCase().includes(q);
      const matchDetails = detail(e).toLowerCase().includes(q);
      const matchTarget = e.target.toLowerCase().includes(q);
      return matchActor || matchAction || matchDetails || matchTarget;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Search and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`min-h-10 rounded-xl px-3.5 py-1.5 text-xs font-bold transition md:min-h-0 ${
                activeCategory === cat.id
                  ? "border-2 border-[var(--border-strong)] bg-amber-400 text-[var(--text-primary)] shadow-[2px_2px_0px_rgba(26,30,41,0.12)]"
                  : "border-2 border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] shadow-[2px_2px_0px_rgba(26,30,41,0.04)]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            aria-label="Search the audit log"
            className="w-full rounded-xl border-2 border-[var(--border-default)] bg-white px-3.5 py-2.5 text-sm md:py-2 md:text-xs font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-amber-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 transition shadow-[2px_2px_0px_rgba(26,30,41,0.04)]"
          />
        </div>
      </div>

      {/* Phones: one entry per row, stacked. */}
      <ul className="divide-y divide-[var(--border-subtle)] rounded-2xl border-2 border-[var(--border-default)] bg-white md:hidden">
        {filtered.length === 0 ? (
          <li className="p-6 text-center text-sm text-[var(--text-muted)]">Nothing matches that filter.</li>
        ) : (
          filtered.map((e) => (
            <li key={e.seq} className="p-4 text-sm">
              <div className="flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
                <span>{when(e.at)}</span>
                <span className="font-mono">#{e.seq}</span>
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2 py-0.5 text-xs font-bold">{e.actor}</span>
                <span className="font-semibold">{ACTION_LABEL[e.action] ?? e.action}</span>
              </p>
              {detail(e) && <p className="mt-1 text-[var(--text-secondary)]">{detail(e)}</p>}
            </li>
          ))
        )}
      </ul>

      {/* Wider screens: the table. */}
      <div className="hidden overflow-x-auto md:block rounded-2xl border-2 border-[var(--border-default)] bg-white shadow-[4px_4px_0px_rgba(26,30,41,0.06)]">
        <table className="w-full min-w-[700px] text-left text-xs">
          <thead>
            <tr className="border-b-2 border-[var(--border-default)] bg-[var(--bg-subtle)] text-xs font-medium text-[var(--text-secondary)]">
              <th className="px-4 py-3.5">#</th>
              <th className="px-4 py-3.5">Time (WAT)</th>
              <th className="px-4 py-3.5">Actor</th>
              <th className="px-4 py-3.5">Action</th>
              <th className="px-4 py-3.5">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[var(--text-muted)]">
                  Nothing matches that filter.
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.seq} className="hover:bg-amber-50/40 transition-colors align-top">
                  <td className="px-4 py-3.5 font-mono font-medium text-[var(--text-muted)]">#{e.seq}</td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-[var(--text-secondary)]">{when(e.at)}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-block rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2 py-0.5 font-bold text-[var(--text-primary)]">
                      {e.actor}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-bold text-[var(--text-primary)]">
                    {ACTION_LABEL[e.action] ?? e.action}
                  </td>
                  <td className="px-4 py-3.5 text-[var(--text-secondary)] leading-relaxed">{detail(e)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center text-xs text-[var(--text-secondary)] px-1 font-medium">
        <span>Showing {filtered.length} of {entries.length} entries</span>
      </div>
    </div>
  );
}
