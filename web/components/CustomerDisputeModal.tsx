"use client";

import { useState } from "react";
import type { CustomerSummary } from "@/lib/types";
import { money } from "@/lib/format";

type Props = {
  data: CustomerSummary;
  periodText: string;
};

export function CustomerDisputeModal({ data, periodText }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const credit = data.bill.recommendations.find((r) => r.type === "downgrade_credit");

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0E1524] px-3.5 py-2 text-xs font-semibold text-slate-200 shadow-xs transition hover:border-slate-500 hover:text-white active:scale-[0.98]"
      >
        <svg className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <span>NERC Dispute &amp; Tariff Rights</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0E1524] text-slate-100 p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3.5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  NERC Consumer Protection
                </span>
                <h3 className="text-lg font-bold text-white">Dispute Rights &amp; Regulatory Guidance</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-4 text-xs leading-relaxed">
              {/* Telemetry Summary */}
              <div className="rounded-xl border border-slate-800 bg-[#090D16] p-4 text-slate-300">
                <p className="font-semibold text-white">Audited Telemetry Record ({periodText}):</p>
                <ul className="mt-2 list-disc pl-4 space-y-1 text-slate-400">
                  <li>
                    Meter: <strong className="text-white">{data.meter_id}</strong> on Feeder <strong className="text-white">{data.bill.feeder_id}</strong>
                  </li>
                  <li>
                    Assigned Band: <strong className="text-white">Band {data.supply.band}</strong> (Guaranteed {data.supply.committed_hours}h daily supply)
                  </li>
                  <li>
                    Delivered Daily Average: <strong className="text-white">{data.supply.average_hours.toFixed(1)}h/day</strong>
                  </li>
                  <li>
                    Commitment Fulfilled: {data.supply.days_met} of {data.supply.days_met + data.supply.days_failed} audited days
                  </li>
                  {credit && (
                    <li className="text-amber-400 font-medium">
                      Calculated Downgrade Credit: {money(credit.amount!)}
                    </li>
                  )}
                </ul>
              </div>

              {/* Statutory Protections */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-slate-300">
                <p className="font-semibold text-emerald-400">Statutory NERC 7-Day Rule Rights:</p>
                <p className="mt-1 text-slate-300">
                  Under NERC Order NERC/2024/032, if a feeder fails its Band commitment for 7 consecutive days, the DisCo is legally required to downgrade the feeder to the lower tariff band corresponding to actual supply delivered and credit customers for overbilled hours.
                </p>
              </div>

              {/* Official Escalation Steps */}
              <div className="rounded-xl border border-slate-800 bg-[#131C2E] p-3.5">
                <p className="font-semibold text-white">How to Resolve with Your DisCo:</p>
                <ol className="mt-1.5 list-decimal pl-4 space-y-1 text-slate-400">
                  <li>
                    Contact your DisCo Customer Complaints Unit (CCU) quoting Meter <span className="font-mono text-white">{data.meter_id}</span> and Feeder <span className="font-mono text-white">{data.bill.feeder_id}</span>.
                  </li>
                  <li>
                    Reference the daily audited telemetry readings and calculated fulfillment percentage displayed in this portal.
                  </li>
                  <li>
                    If the DisCo fails to apply your tariff downgrade credit within 15 working days, escalate directly to the local NERC Forum Office.
                  </li>
                </ol>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition"
              >
                Close Guidance
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
