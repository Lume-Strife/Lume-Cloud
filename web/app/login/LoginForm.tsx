"use client";

import { useActionState } from "react";

import { signIn, type LoginState } from "../actions";

export function LoginForm({ notice }: { notice: string | null }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, { error: null, username: "" });
  const error = state.error ?? notice;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Username
        <input
          name="username"
          autoComplete="username"
          defaultValue={state.username}
          required
          className="rounded-md border border-rule-strong bg-surface px-3 py-2.5 text-base font-normal text-ink"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-md border border-rule-strong bg-surface px-3 py-2.5 text-base font-normal text-ink"
        />
      </label>
      {error && (
        <p role="alert" className="border-l-4 border-breach pl-3 text-sm text-ink">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-ink px-4 py-2.5 font-semibold text-paper hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
