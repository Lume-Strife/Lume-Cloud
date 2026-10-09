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
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#131C2E] border border-slate-700 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            Immutable Audit Log
          </span>
          <span className="text-xs text-slate-500">Cryptographic Verification</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Verifiable System Audit Trail</h1>
        <p className="mt-1.5 max-w-[72ch] text-sm text-slate-400 leading-relaxed">
          Every authentication attempt, fraud flag adjudication, compliance export, and meter query is permanently recorded in a SHA-256 hash-chained ledger. Any retroactive alteration or record removal immediately invalidates the cryptographic chain.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {log.chain_intact ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-400">
              <StatusMark tone="good">SHA-256 Chain Intact</StatusMark>
              <span className="text-emerald-400/80 font-normal">· All sequential hash blocks valid and verified</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 text-xs font-semibold text-rose-400">
              <StatusMark tone="bad">Cryptographic Chain Compromised</StatusMark>
              <span className="font-normal text-rose-400/80">· Tampering detected starting at sequence #{log.first_broken_seq}</span>
            </div>
          )}
        </div>
      </div>

      <AuditLogViewer entries={log.entries} />
    </div>
  );
}
