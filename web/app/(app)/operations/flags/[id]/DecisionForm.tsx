"use client";

import { useActionState } from "react";

import { decideFlag } from "@/app/actions";
import type { FlagStatus } from "@/lib/types";

const OPTIONS: { value: Exclude<FlagStatus, "open">; label: string; hint: string }[] = [
  { value: "investigating", label: "Investigating", hint: "A field visit is planned or under way" },
  { value: "confirmed", label: "Confirmed", hint: "Theft or tampering found on site" },
  { value: "dismissed", label: "Dismissed", hint: "Explained by something legitimate" },
];

export function DecisionForm({ flagId, current }: { flagId: number; current: FlagStatus }) {
  const [state, action, pending] = useActionState<{ error: string | null }, FormData>(decideFlag.bind(null, flagId), { error: null });
  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Outcome</legend>
        {OPTIONS.map((o) => (
          <label key={o.value} className="flex cursor-pointer gap-3 rounded-md border border-rule px-3 py-2.5 has-[:checked]:border-ink">
            <input type="radio" name="status" value={o.value} defaultChecked={current === o.value} required className="mt-1 accent-[var(--ink)]" />
            <span>
              <span className="block font-medium">{o.label}</span>
              <span className="block text-sm text-ink-2">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        What did you find?
        <textarea
          name="note"
          rows={4}
          maxLength={1000}
          className="rounded-md border border-rule-strong bg-paper px-3 py-2 text-base font-normal"
          placeholder="Required to confirm or dismiss"
        />
      </label>
      {state.error && (
        <p role="alert" className="border-l-4 border-breach pl-3 text-sm">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="rounded-md bg-ink px-4 py-2.5 font-semibold text-paper hover:opacity-90 disabled:opacity-60">
        {pending ? "Saving…" : "Save decision"}
      </button>
    </form>
  );
}
