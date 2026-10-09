import type { OfficialFeederMetadata } from "@/lib/types";
import { kwh } from "@/lib/format";

type Props = {
  metadata: OfficialFeederMetadata;
  compact?: boolean;
};

export function OfficialFeederMetadataCard({ metadata, compact = false }: Props) {
  if (compact) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-slate-900">NERC Register: {metadata.source_feeder_name || "Official Feeder"}</span>
          <span className="text-slate-500">{[metadata.disco, metadata.state, metadata.business_unit].filter(Boolean).join(" · ")}</span>
        </div>
        {metadata.monthly_energy_cap_kwh !== null && (
          <div className="mt-1.5 flex items-center justify-between text-slate-700">
            <span>NERC Monthly Energy Cap:</span>
            <span className="font-semibold text-slate-900">
              {kwh(metadata.monthly_energy_cap_kwh)} <span className="font-normal text-slate-500">(regulatory billing ceiling, not supply)</span>
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
        <h4 className="text-sm font-bold text-slate-900">
          Official NERC Feeder Register Information
        </h4>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">NERC Transcribed Record</span>
      </div>
      <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-slate-500">Registered Name</dt>
          <dd className="font-semibold text-slate-900">{metadata.source_feeder_name || "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Distribution Co.</dt>
          <dd className="font-semibold text-slate-900">{metadata.disco || "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">State / Unit</dt>
          <dd className="font-semibold text-slate-900">
            {[metadata.state, metadata.business_unit].filter(Boolean).join(" / ") || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Monthly Energy Cap</dt>
          <dd className="font-semibold text-slate-900">
            {metadata.monthly_energy_cap_kwh !== null ? kwh(metadata.monthly_energy_cap_kwh) : "—"}
          </dd>
        </div>
      </dl>
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
        <span>Regulatory information published by NERC. This cap is a regulatory billing limit, not telemetry or delivered energy.</span>
        {metadata.source_url && (
          <a
            href={metadata.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-700 font-semibold underline underline-offset-2 hover:text-emerald-800"
          >
            Source document ↗
          </a>
        )}
      </div>
    </div>
  );
}
