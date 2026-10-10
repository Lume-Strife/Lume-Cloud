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
          <span className="section-pill">
            Immutable Audit Log
          </span>
          <span className="text-xs text-[var(--text-muted)] font-medium">Cryptographic Verification</span>
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--text-primary)]">Verifiable System Audit Trail</h1>
        <p className="mt-1.5 max-w-[72ch] text-sm text-[var(--text-secondary)] leading-relaxed">
          Every authentication attempt, fraud flag adjudication, compliance export, and meter query is permanently recorded in a SHA-256 hash-chained ledger. Any retroactive alteration or record removal immediately invalidates the cryptographic chain.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {log.chain_intact ? (
            <div className="flex items-center gap-2 rounded-xl border-2 border-emerald-400 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-900 shadow-[2px_2px_0px_rgba(16,185,129,0.15)]">
              <StatusMark tone="good">SHA-256 Chain Intact</StatusMark>
              <span className="text-emerald-800 font-normal">· All sequential hash blocks valid and verified</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border-2 border-rose-400 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-900 shadow-[2px_2px_0px_rgba(244,63,94,0.15)]">
              <StatusMark tone="bad">Cryptographic Chain Compromised</StatusMark>
              <span className="font-normal text-rose-800">· Tampering detected starting at sequence #{log.first_broken_seq}</span>
            </div>
          )}
        </div>
      </div>

      <AuditLogViewer entries={log.entries} />
    </div>
  );
}
