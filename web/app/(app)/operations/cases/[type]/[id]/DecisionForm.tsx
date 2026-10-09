"use client";

import { useActionState, useState } from "react";
import { decideCase } from "@/app/actions";
import type { FlagStatus } from "@/lib/types";

const OPTIONS: { value: Exclude<FlagStatus, "open">; label: string; hint: string; color: string }[] = [
  {
    value: "investigating",
    label: "Investigating",
    hint: "A field visit is planned or technician dispatched",
    color: "accent-sky-600",
  },
  {
    value: "confirmed",
    label: "Confirmed Anomaly / Theft",
    hint: "Theft, bypass, or meter tampering verified on site",
    color: "accent-orange-600",
  },
  {
    value: "dismissed",
    label: "Dismissed (Legitimate)",
    hint: "Explained by legitimate conditions (e.g., unoccupied premise)",
    color: "accent-emerald-600",
  },
];

type Props = { subjectType: "meter" | "feeder"; subjectId: string; current: FlagStatus };

export function DecisionForm({ subjectType, subjectId, current }: Props) {
  const [selectedStatus, setSelectedStatus] = useState<string>(
    current === "open" ? "investigating" : current
  );
  const [noteLength, setNoteLength] = useState(0);

  const [state, action, pending] = useActionState<{ error: string | null }, FormData>(
    decideCase.bind(null, subjectType, subjectId),
    { error: null },
  );

  const noteRequired = selectedStatus === "confirmed" || selectedStatus === "dismissed";

  return (
    <form action={action} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Actionable Outcome</legend>
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
              selectedStatus === o.value
                ? "border-slate-900 bg-slate-50 shadow-xs ring-1 ring-slate-900"
                : "border-slate-200 bg-white hover:bg-slate-50/70"
            }`}
          >
            <input
              type="radio"
              name="status"
              value={o.value}
              checked={selectedStatus === o.value}
              onChange={(e) => setSelectedStatus(e.target.value)}
              required
              className={`mt-1 h-4 w-4 ${o.color}`}
            />
            <span className="flex-1">
              <span className="block font-bold text-xs text-slate-900">{o.label}</span>
              <span className="block text-[11px] text-slate-500 mt-0.5">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
        <div className="flex justify-between items-baseline">
          <span>
            Field Findings &amp; Decision Notes{" "}
            {noteRequired && <span className="text-rose-600 text-xs font-normal">(Required, ≥ 3 characters)</span>}
          </span>
          <span className="text-[11px] text-slate-400 font-normal">{noteLength}/1000</span>
        </div>
        <textarea
          name="note"
          rows={4}
          maxLength={1000}
          onChange={(e) => setNoteLength(e.target.value.length)}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-normal text-slate-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 transition shadow-2xs"
          placeholder={
            noteRequired
              ? "Describe evidence inspected on site, technician name, and seal status..."
              : "Optional notes regarding dispatch schedule..."
          }
        />
      </label>

      {state.error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <p className="font-semibold">Unable to save decision</p>
          <p className="mt-0.5">{state.error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-xs text-white shadow-xs transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
      >
        {pending ? "Writing to audit log…" : "Record Final Decision"}
      </button>

      <p className="text-[11px] text-slate-400 text-center">
        This decision permanently seals across all signals in this case and appends a SHA-256 hash to the tamper-evident audit trail.
      </p>
    </form>
  );
}
