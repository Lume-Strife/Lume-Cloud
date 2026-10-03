import { StatusMark } from "@/components/StatusMark";
import { apiFetch } from "@/lib/api";
import { periodLabel, when } from "@/lib/format";
import { requireRole } from "@/lib/session";
import type { AuditEntry, AuditLog } from "@/lib/types";

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

export default async function AuditPage() {
  await requireRole("operations", "regulator");
  const log = await apiFetch<AuditLog>("/audit?limit=300");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Audit trail</h1>
        <p className="mt-2 max-w-[68ch] text-ink-2">
          Every sign-in, flag decision, data view and export. Entries can&apos;t be edited or deleted, and each one is sealed with
          a hash of the one before it, so any change breaks the chain.
        </p>
        <div className="mt-4">
          {log.chain_intact ? (
            <StatusMark tone="good">Chain intact: no entry has been altered</StatusMark>
          ) : (
            <StatusMark tone="bad">Chain broken at entry {log.first_broken_seq}: records from there on can&apos;t be trusted</StatusMark>
          )}
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-rule bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-rule text-muted">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Who</th>
              <th className="px-4 py-3 font-medium">What</th>
              <th className="px-4 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {log.entries.map((e) => (
              <tr key={e.seq} className="border-b border-rule last:border-0 align-top">
                <td className="px-4 py-2.5 text-muted">{e.seq}</td>
                <td className="whitespace-nowrap px-4 py-2.5">{when(e.at)}</td>
                <td className="px-4 py-2.5 font-medium">{e.actor}</td>
                <td className="px-4 py-2.5">{ACTION_LABEL[e.action] ?? e.action}</td>
                <td className="px-4 py-2.5 text-ink-2">{detail(e)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
