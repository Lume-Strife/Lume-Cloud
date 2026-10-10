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
    label: "Confirmed",
    hint: "Theft, bypass, or meter tampering verified on site",
    color: "accent-orange-600",
  },
  {
    value: "dismissed",
    label: "Dismissed",
    hint: "There is an innocent explanation, such as an empty house",
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
        <legend className="mb-2 text-sm font-semibold text-[var(--text-secondary)]">Outcome</legend>
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3.5 transition-all ${
              selectedStatus === o.value
                ? "border-[var(--border-strong)] bg-amber-50/70 shadow-[2px_2px_0px_rgba(26,30,41,0.1)] ring-1 ring-[var(--border-strong)]"
                : "border-[var(--border-default)] bg-white hover:border-[var(--border-strong)]"
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
              <span className="block font-bold text-xs text-[var(--text-primary)]">{o.label}</span>
              <span className="block text-[11px] text-[var(--text-muted)] mt-0.5">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
        <div className="flex justify-between items-baseline">
          <span>
            Notes{" "}
            {noteRequired && <span className="text-rose-700 text-xs font-bold">(required)</span>}
          </span>
          <span className="text-[11px] text-[var(--text-muted)] font-medium">{noteLength}/1000</span>
        </div>
        <textarea
          name="note"
          rows={4}
          maxLength={1000}
          required={noteRequired}
          minLength={noteRequired ? 3 : undefined}
          onChange={(e) => setNoteLength(e.target.value.length)}
          className="rounded-xl border-2 border-[var(--border-default)] bg-white px-3.5 py-2.5 text-xs font-medium text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-amber-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 transition shadow-[2px_2px_0px_rgba(26,30,41,0.04)]"
          placeholder={
            noteRequired
              ? "What did you find on site? Who visited, and was the seal intact?"
              : "Optional, e.g. when the visit is booked"
          }
        />
      </label>

      {state.error && (
        <div role="alert" className="rounded-xl border-2 border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
          <p className="font-bold">Couldn&apos;t save the decision</p>
          <p className="mt-0.5 font-medium">{state.error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl border-2 border-[var(--border-strong)] bg-amber-400 px-4 py-2.5 font-bold text-xs text-[var(--text-primary)] shadow-[2px_2px_0px_rgba(26,30,41,0.12)] transition hover:bg-amber-300 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
      >
        {pending ? "Saving…" : "Save decision"}
      </button>

      <p className="text-[11px] text-[var(--text-muted)] text-center font-medium">
        This decision applies to every signal in this case and is written to the tamper-evident audit trail.
      </p>
    </form>
  );
}
