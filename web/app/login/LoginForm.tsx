"use client";

import { useActionState, useState } from "react";
import { signIn, type LoginState } from "../actions";

const DEMO_ACCOUNTS = [
  {
    role: "Customer (Band A)",
    user: "customer",
    desc: "Meter M0001 · Unilorin Feeder",
    tag: "Band A",
    tagColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  {
    role: "Customer (Band E)",
    user: "customer2",
    desc: "Meter M0081 · Lowest Band",
    tag: "Band E",
    tagColor: "bg-rose-100 text-rose-800 border-rose-300",
  },
  {
    role: "DisCo Operations",
    user: "ops",
    desc: "Theft leads & feeder balance",
    tag: "Ops",
    tagColor: "bg-sky-100 text-sky-800 border-sky-300",
  },
  {
    role: "NERC Regulator",
    user: "regulator",
    desc: "7-Day Rule compliance",
    tag: "Regulator",
    tagColor: "bg-amber-100 text-amber-800 border-amber-300",
  },
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
      {/* Quick Demo Switcher */}
      <div className="rounded-xl border-2 border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          ⚡ Instant demo personas
        </span>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.user}
              type="button"
              onClick={() => fillAccount(a.user)}
              aria-pressed={username === a.user}
              className="flex flex-col items-start rounded-lg border-2 border-[var(--border-default)] bg-white aria-pressed:border-amber-500 aria-pressed:bg-amber-50 p-2.5 text-left transition hover:border-[var(--border-strong)] hover:shadow-[2px_2px_0px_rgba(26,30,41,0.10)] active:scale-[0.98]"
            >
              <div className="flex w-full items-center justify-between gap-1">
                <span className="font-bold text-xs text-[var(--text-primary)] leading-snug">{a.role}</span>
                <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black leading-none ${a.tagColor}`}>
                  {a.tag}
                </span>
              </div>
              <span className="mt-0.5 text-[10px] text-[var(--text-muted)]">{a.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Credential Form */}
      <form action={action} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          Username
          <input
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            placeholder="customer, ops, regulator…"
            className="rounded-lg border-2 border-[var(--border-default)] bg-white px-3.5 py-2.5 text-sm font-normal text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          Password
          <input
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            placeholder="Enter password"
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
          className="mt-1 rounded-lg border-2 border-[var(--border-strong)] bg-[var(--text-primary)] px-4 py-2.5 text-sm font-bold text-white shadow-[3px_3px_0px_rgba(26,30,41,0.20)] transition hover:shadow-[4px_4px_0px_rgba(26,30,41,0.26)] hover:-translate-y-px active:translate-y-px active:shadow-none disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {pending ? "Signing in…" : "Sign in to Lume"}
        </button>
      </form>
    </div>
  );
}
