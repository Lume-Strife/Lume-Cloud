import Link from "next/link";
import { redirect } from "next/navigation";
import { LumeLogo } from "@/components/LumeLogo";
import { getUser, HOME } from "@/lib/session";
import { LoginForm } from "./LoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
};

type PageProps = {
  searchParams: Promise<{ expired?: string; as?: string }>;
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps) {
  const user = await getUser().catch(() => null);
  if (user) redirect(HOME[user.role]);
  const { expired, as } = await searchParams;

  return (
    <main className="min-h-screen bg-[var(--bg-canvas)] grid-canvas flex items-center justify-center p-4 sm:p-6 md:p-10">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.1fr_1fr]">

        {/* ── Left Column: Lume Brand + Value ─────────────────── */}
        <section className="flex flex-col gap-7">
          {/* Wordmark */}
          <Link href="/" className="self-start" aria-label="Lume home">
            <LumeLogo size="xl" />
          </Link>

          {/* Headline */}
          <div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.05] text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
              Smart electricity
              <br />
              <span className="relative inline-block isolate mt-1">
                <span className="relative z-10 text-amber-700">accountability.</span>
                <span
                  className="absolute inset-0 -bottom-0.5 rounded bg-amber-200 -z-10 rotate-[-1.5deg]"
                  aria-hidden
                />
              </span>
            </h1>
            <p className="mt-4 text-sm text-[var(--text-muted)] leading-relaxed max-w-[44ch]">
              Lume continuously verifies whether your feeder delivered the supply hours your
              NERC tariff band guarantees — and flags tamper events, bypass attempts, and billing
              anomalies before they become disputes.
            </p>
          </div>

          {/* Role highlights */}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                role: "Customers",
                body: "Audited daily supply hours alongside itemised bills and automatic downgrade credits.",
                color: "border-emerald-200 bg-emerald-50",
                dot: "bg-emerald-500",
              },
              {
                role: "DisCo Ops",
                body: "Algorithmic theft and bypass detection ranking field leads by confidence.",
                color: "border-sky-200 bg-sky-50",
                dot: "bg-sky-500",
              },
              {
                role: "Regulators",
                body: "Feeder 7-Day Rule compliance reports and tamper-evident CSV evidence dockets.",
                color: "border-amber-200 bg-amber-50",
                dot: "bg-amber-500",
              },
            ].map(({ role, body, color, dot }) => (
              <div
                key={role}
                className={`rounded-xl border-2 border-[var(--border-strong)] ${color} p-3.5 shadow-[2px_2px_0px_rgba(26,30,41,0.08)]`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
                  <span className="text-xs font-bold text-[var(--text-primary)]">{role}</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-normal">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Right Column: Sign-In Panel ──────────────────────── */}
        <section className="rounded-2xl border-2 border-[var(--border-strong)] bg-white p-7 sm:p-9 shadow-[6px_6px_0px_rgba(26,30,41,0.10)]">
          <div className="border-b border-[var(--border-subtle)] pb-5">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Sign in to Lume</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Select a demo persona or enter credentials
            </p>
          </div>

          <div className="mt-6">
            <LoginForm notice={expired ? "Your session ended. Please sign in again." : null} initialUser={as ?? null} />
          </div>

          <p className="mt-6 border-t border-[var(--border-subtle)] pt-4 text-center text-[11px] text-[var(--text-faint)]">
            Demo environment · all meter readings are simulated · data sources explicitly verified
          </p>
        </section>
      </div>
    </main>
  );
}
