"use client";

import { useActionState, useState } from "react";
import { signIn, type LoginState } from "../actions";

const DEMO_ACCOUNTS = [
  { role: "Customer (Band A)", user: "customer", desc: "Meter M0001 · Unilorin Feeder", tag: "Band A" },
  { role: "Customer 2 (Band E)", user: "customer2", desc: "Meter M0081 · Lowest Band", tag: "Band E" },
  { role: "DisCo Operations", user: "ops", desc: "Theft leads & Feeder balance", tag: "Ops" },
  { role: "NERC Regulator", user: "regulator", desc: "7-Day Rule compliance", tag: "Regulator" },
];

export function LoginForm({ notice }: { notice: string | null }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, { error: null, username: "" });
  const [username, setUsername] = useState(state.username || "");
  const [password, setPassword] = useState("");

  const fillAccount = (user: string) => {
    setUsername(user);
    setPassword("demo-password");
  };

  const error = state.error ?? notice;

  return (
    <div className="flex flex-col gap-6">
      {/* Quick Demo Credentials Switcher */}
      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Instant Demo Personas
        </span>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.user}
              type="button"
              onClick={() => fillAccount(a.user)}
              className="flex flex-col items-start rounded-lg border border-slate-200/80 bg-white p-2.5 text-left transition hover:border-slate-900 hover:shadow-xs active:scale-[0.98]"
            >
              <div className="flex w-full items-center justify-between">
                <span className="font-semibold text-xs text-slate-900">{a.role}</span>
                <span className="rounded bg-slate-100 px-1 py-0.2 text-[9px] font-bold text-slate-600">
                  {a.tag}
                </span>
              </div>
              <span className="mt-0.5 text-[10px] text-slate-500">{a.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <form action={action} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700">
          Username
          <input
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            placeholder="e.g. customer, ops, regulator"
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 transition shadow-2xs"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700">
          Password
          <input
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            placeholder="Enter password"
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 transition shadow-2xs"
          />
        </label>

        {error && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
        >
          {pending ? "Authenticating…" : "Sign In to Lume"}
        </button>
      </form>
    </div>
  );
}
