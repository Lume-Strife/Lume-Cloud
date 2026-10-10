"use client";

import { useActionState, useState } from "react";
import { signIn, type LoginState } from "../actions";

const DEMO_ACCOUNTS = [
  { user: "customer", name: "Customer", desc: "Band A feeder" },
  { user: "customer2", name: "Customer", desc: "Lowest-band feeder" },
  { user: "ops", name: "DisCo operations", desc: "Theft leads and feeders" },
  { user: "regulator", name: "Regulator", desc: "Band and 7-Day Rule checks" },
];

export function LoginForm({ notice, initialUser }: { notice: string | null; initialUser: string | null }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {
    error: null,
    username: "",
  });
  // A persona picked on the landing page arrives as ?as=<user>; only known demo users are pre-filled.
  const preset = DEMO_ACCOUNTS.some((a) => a.user === initialUser) ? initialUser! : "";
  const [username, setUsername] = useState(state.username || preset);
  const [password, setPassword] = useState(preset ? "demo-password" : "");

  const fillAccount = (user: string) => {
    setUsername(user);
    setPassword("demo-password");
  };

  const error = state.error ?? notice;

  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="text-sm font-medium text-[var(--text-secondary)]">Demo accounts</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.user}
              type="button"
              onClick={() => fillAccount(a.user)}
              aria-pressed={username === a.user}
              className="flex flex-col items-start rounded-lg border-2 border-[var(--border-default)] bg-white p-3 text-left transition hover:border-[var(--border-strong)] aria-pressed:border-amber-500 aria-pressed:bg-amber-50"
            >
              <span className="text-sm font-semibold">{a.name}</span>
              <span className="mt-0.5 text-xs text-[var(--text-muted)]">{a.desc}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <form action={action} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text-secondary)]">
          Username
          <input
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            className="rounded-lg border-2 border-[var(--border-default)] bg-white px-3.5 py-2.5 text-sm font-normal text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text-secondary)]">
          Password
          <input
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="rounded-lg border-2 border-[var(--border-default)] bg-white px-3.5 py-2.5 text-sm font-normal text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition"
          />
        </label>

        {error && (
          <div
            role="alert"
            className="rounded-lg border-2 border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 font-medium"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="btn-primary mt-1 justify-center py-3"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
