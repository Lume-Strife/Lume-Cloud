import type { OfficialFeederMetadata } from "@/lib/types";
import { kwh } from "@/lib/format";

type Props = {
  metadata: OfficialFeederMetadata;
  compact?: boolean;
};

export function OfficialFeederMetadataCard({ metadata, compact = false }: Props) {
  if (compact) {
    return (
      <div className="rounded-xl border-2 border-[var(--border-default)] bg-[var(--bg-subtle)] p-3.5 text-xs text-[var(--text-primary)] shadow-[2px_2px_0px_rgba(26,30,41,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-[var(--text-primary)]">NERC Register: {metadata.source_feeder_name || "Official Feeder"}</span>
          <span className="text-[var(--text-muted)] font-medium">{[metadata.disco, metadata.state, metadata.business_unit].filter(Boolean).join(" · ")}</span>
        </div>
        {metadata.monthly_energy_cap_kwh !== null && (
          <div className="mt-1.5 flex items-center justify-between text-[var(--text-secondary)] font-medium">
            <span>NERC Monthly Energy Cap:</span>
            <span className="font-bold text-[var(--text-primary)]">
              {kwh(metadata.monthly_energy_cap_kwh)} <span className="font-normal text-[var(--text-muted)]">(regulatory billing ceiling, not supply)</span>
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-[var(--border-default)] bg-white p-5 text-[var(--text-primary)] shadow-[3px_3px_0px_rgba(26,30,41,0.06)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
        <h4 className="text-sm font-bold text-[var(--text-primary)]">
          NERC feeder register
        </h4>
      </div>
      <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-[var(--text-muted)]">Registered name</dt>
          <dd className="font-semibold text-[var(--text-primary)]">{metadata.source_feeder_name || "Not listed"}</dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">DisCo</dt>
          <dd className="font-semibold text-[var(--text-primary)]">{metadata.disco || "Not listed"}</dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">State and unit</dt>
          <dd className="font-semibold text-[var(--text-primary)]">
            {[metadata.state, metadata.business_unit].filter(Boolean).join(" / ") || "Not listed"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">Monthly energy cap</dt>
          <dd className="font-semibold text-[var(--text-primary)]">
            {metadata.monthly_energy_cap_kwh !== null ? kwh(metadata.monthly_energy_cap_kwh) : "Not listed"}
          </dd>
        </div>
      </dl>
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2.5 text-[11px] text-[var(--text-muted)]">
        <span>Published by NERC. The cap is a billing limit, not energy delivered.</span>
        {metadata.source_url && (
          <a
            href={metadata.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-800 font-bold underline underline-offset-2 hover:text-amber-900"
          >
            Source ↗
          </a>
        )}
      </div>
    </div>
  );
}
