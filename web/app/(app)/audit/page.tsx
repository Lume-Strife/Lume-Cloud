import { StatusMark } from "@/components/StatusMark";
import { AuditLogViewer } from "@/components/AuditLogViewer";
import { apiFetch } from "@/lib/api";
import { requireRole } from "@/lib/session";
import type { AuditLog } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireRole("operations", "regulator");
  const log = await apiFetch<AuditLog>("/audit?limit=300");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text-primary)]">Audit log</h1>
        <p className="mt-1.5 max-w-[72ch] text-sm text-[var(--text-secondary)] leading-relaxed">
          Every sign-in, decision, export and meter lookup is recorded here. Each entry carries a hash of the one before it, so changing or deleting an old entry breaks the chain.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {log.chain_intact ? (
            <div className="flex items-center gap-2 rounded-xl border-2 border-emerald-400 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-900 shadow-[2px_2px_0px_rgba(16,185,129,0.15)]">
              <StatusMark tone="good">Chain intact</StatusMark>
              <span className="text-emerald-800 font-normal">· every entry checks out</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border-2 border-rose-400 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-900 shadow-[2px_2px_0px_rgba(244,63,94,0.15)]">
              <StatusMark tone="bad">Chain broken</StatusMark>
              <span className="font-normal text-rose-800">· entries from #{log.first_broken_seq} onward don&apos;t match</span>
            </div>
          )}
        </div>
      </div>

      <AuditLogViewer entries={log.entries} />
    </div>
  );
}
