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
  "detection.run": "Ran theft detection",
  "demo.seed": "Created demo data",
};

const CATEGORIES = [
  { id: "all", label: "All Events" },
  { id: "decisions", label: "Decisions", filter: (a: string) => a.includes("decide") },
  { id: "detection", label: "Detection Runs", filter: (a: string) => a.includes("detection") },
  { id: "views", label: "Data Views & Exports", filter: (a: string) => a.includes("view") || a.includes("export") },
  { id: "auth", label: "Authentication", filter: (a: string) => a.startsWith("auth") },
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
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeCategory === cat.id
                  ? "bg-[#162032] text-emerald-400 border border-emerald-500/40 shadow-xs"
                  : "border border-slate-800 bg-[#0E1524] text-slate-400 hover:border-slate-700 hover:text-white"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actor, target, note..."
            className="w-full rounded-lg border border-slate-800 bg-[#0E1524] px-3.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 transition shadow-2xs"
          />
        </div>
      </div>

      {/* Table: Deliberate Lighter Panel for Scan Readability */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-md">
        <table className="w-full min-w-[700px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3.5">Seq #</th>
              <th className="px-4 py-3.5">Timestamp (WAT)</th>
              <th className="px-4 py-3.5">Actor</th>
              <th className="px-4 py-3.5">Action</th>
              <th className="px-4 py-3.5">Audit Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  No audit entries found matching the filter criteria.
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.seq} className="hover:bg-slate-50/70 transition-colors align-top">
                  <td className="px-4 py-3.5 font-mono font-medium text-slate-400">#{e.seq}</td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">{when(e.at)}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-800">
                      {e.actor}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-bold text-slate-900">
                    {ACTION_LABEL[e.action] ?? e.action}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 leading-relaxed">{detail(e)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center text-xs text-slate-400 px-1">
        <span>Showing {filtered.length} of {entries.length} audited records</span>
        <span className="font-mono text-[11px] text-slate-500">SHA-256 Linked Sequence</span>
      </div>
    </div>
  );
}
