"use client";

import { useRef } from "react";
import type { CustomerSummary } from "@/lib/types";
import { money } from "@/lib/format";

type Props = {
  data: CustomerSummary;
  periodText: string;
};

/** Native <dialog>: focus is trapped, Escape closes it, and focus returns to the trigger. */
export function CustomerDisputeModal({ data, periodText }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const credit = data.bill.recommendations.find((r) => r.type === "downgrade_credit");
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex items-center gap-2 rounded-xl border-2 border-[var(--border-default)] bg-white px-3.5 py-2 text-xs font-bold text-[var(--text-primary)] shadow-[2px_2px_0px_rgba(26,30,41,0.06)] transition hover:border-[var(--border-strong)] hover:text-amber-800 active:scale-[0.98]"
      >
        <svg className="h-4 w-4 text-amber-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <span>Dispute a bill</span>
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="dispute-title"
        // A click on the backdrop lands on the <dialog> element itself.
        onClick={(e) => e.target === e.currentTarget && close()}
        className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border-2 border-[var(--border-strong)] bg-white p-0 text-[var(--text-primary)] shadow-[6px_6px_0px_rgba(26,30,41,0.18)] backdrop:bg-[rgba(26,30,41,0.55)]"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 border-b-2 border-[var(--border-default)] pb-3.5">
            <div>
              <h2 id="dispute-title" className="text-lg font-bold text-[var(--text-primary)]">
                Your rights and how to dispute
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-bold text-[var(--text-muted)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
              aria-label="Close dialog"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-4 text-xs leading-relaxed">
            <div className="rounded-xl border-2 border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
              <p className="font-bold text-[var(--text-primary)]">Your audited record ({periodText})</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 font-medium text-[var(--text-secondary)]">
                <li>
                  Meter <strong className="font-bold text-[var(--text-primary)]">{data.meter_id}</strong> on feeder{" "}
                  <strong className="font-bold text-[var(--text-primary)]">{data.bill.feeder_id}</strong>
                </li>
                <li>
                  Band <strong className="font-bold text-[var(--text-primary)]">{data.supply.band}</strong>: {data.supply.committed_hours}h of supply promised per day
                </li>
                <li>
                  Delivered on average: <strong className="font-bold text-[var(--text-primary)]">{data.supply.average_hours.toFixed(1)}h/day</strong>
                </li>
                <li>
                  Promise kept on {data.supply.days_met} of {data.supply.days_met + data.supply.days_failed} judged days
                </li>
                {credit && <li className="font-bold text-amber-800">Recommended downgrade credit: {money(credit.amount!)}</li>}
              </ul>
            </div>

            <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3.5 text-emerald-950">
              <p className="font-bold text-emerald-900">The 7-Day Rule</p>
              <p className="mt-1">
                Under NERC&apos;s service-band rules, a feeder that misses its band commitment for 7 consecutive days should be
                moved to the band that matches the supply it actually delivers, and billed at that band&apos;s tariff.
              </p>
            </div>

            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-3.5 text-amber-950">
              <p className="font-bold text-amber-900">How to raise it with your DisCo</p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4 font-medium text-[var(--text-secondary)]">
                <li>
                  Contact your DisCo&apos;s customer complaints unit, quoting meter{" "}
                  <span className="font-mono font-bold text-[var(--text-primary)]">{data.meter_id}</span> and feeder{" "}
                  <span className="font-mono font-bold text-[var(--text-primary)]">{data.bill.feeder_id}</span>.
                </li>
                <li>Refer to the daily supply hours shown on this page as your evidence.</li>
                <li>If the complaint is not resolved, you can escalate it to NERC.</li>
              </ol>
            </div>

            <p className="text-[11px] text-[var(--text-muted)]">
              This is guidance, not legal advice. Check the current NERC order for exact deadlines and procedures.
            </p>
          </div>

          <div className="mt-6 flex justify-end">
            <button type="button" onClick={close} className="btn-primary btn-amber">
              Close
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
