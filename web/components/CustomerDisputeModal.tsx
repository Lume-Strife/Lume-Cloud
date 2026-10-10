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
        className="inline-flex items-center gap-2 rounded-xl border-2 border-[var(--border-default)] bg-white px-3.5 py-2 text-xs font-bold text-[var(--text-primary)] shadow-[2px_2px_0px_rgba(26,30,41,0.06)] transition hover:border-[var(--border-strong)] hover:text-amber-800 active:scale-[0.98]"
      >
        <svg className="h-4 w-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <span>NERC Dispute &amp; Tariff Rights</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-lg rounded-2xl border-2 border-[var(--border-strong)] bg-white text-slate-900 p-6 shadow-[6px_6px_0px_rgba(26,30,41,0.18)]">
            <div className="flex items-start justify-between border-b-2 border-[var(--border-default)] pb-3.5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                  NERC Consumer Protection
                </span>
                <h3 className="text-lg font-black text-[var(--text-primary)]">Dispute Rights &amp; Regulatory Guidance</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition font-bold"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-4 text-xs leading-relaxed">
              {/* Telemetry Summary */}
              <div className="rounded-xl border-2 border-[var(--border-default)] bg-[var(--bg-subtle)] p-4 text-slate-800">
                <p className="font-bold text-[var(--text-primary)]">Audited Telemetry Record ({periodText}):</p>
                <ul className="mt-2 list-disc pl-4 space-y-1 text-slate-600 font-medium">
                  <li>
                    Meter: <strong className="text-slate-900 font-bold">{data.meter_id}</strong> on Feeder <strong className="text-slate-900 font-bold">{data.bill.feeder_id}</strong>
                  </li>
                  <li>
                    Assigned Band: <strong className="text-slate-900 font-bold">Band {data.supply.band}</strong> (Guaranteed {data.supply.committed_hours}h daily supply)
                  </li>
                  <li>
                    Delivered Daily Average: <strong className="text-slate-900 font-bold">{data.supply.average_hours.toFixed(1)}h/day</strong>
                  </li>
                  <li>
                    Commitment Fulfilled: {data.supply.days_met} of {data.supply.days_met + data.supply.days_failed} audited days
                  </li>
                  {credit && (
                    <li className="text-amber-800 font-bold">
                      Calculated Downgrade Credit: {money(credit.amount!)}
                    </li>
                  )}
                </ul>
              </div>

              {/* Statutory Protections */}
              <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3.5 text-emerald-950">
                <p className="font-bold text-emerald-900">Statutory NERC 7-Day Rule Rights:</p>
                <p className="mt-1 leading-relaxed">
                  Under NERC Order NERC/2024/032, if a feeder fails its Band commitment for 7 consecutive days, the DisCo is legally required to downgrade the feeder to the lower tariff band corresponding to actual supply delivered and credit customers for overbilled hours.
                </p>
              </div>

              {/* Official Escalation Steps */}
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50/70 p-3.5 text-amber-950">
                <p className="font-bold text-amber-900">How to Resolve with Your DisCo:</p>
                <ol className="mt-1.5 list-decimal pl-4 space-y-1 text-slate-700 font-medium">
                  <li>
                    Contact your DisCo Customer Complaints Unit (CCU) quoting Meter <span className="font-mono font-bold text-slate-900">{data.meter_id}</span> and Feeder <span className="font-mono font-bold text-slate-900">{data.bill.feeder_id}</span>.
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
                className="rounded-xl border-2 border-slate-900 bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 shadow-[2px_2px_0px_rgba(26,30,41,0.12)] hover:bg-amber-300 transition"
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
