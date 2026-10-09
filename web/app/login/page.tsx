import { redirect } from "next/navigation";
import { getUser, HOME } from "@/lib/session";
import { LoginForm } from "./LoginForm";

type PageProps = {
  searchParams: Promise<{ expired?: string }>;
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps) {
  const user = await getUser().catch(() => null);
  if (user) redirect(HOME[user.role]);
  const { expired } = await searchParams;

  return (
    <main className="min-h-screen bg-[#090D16] text-slate-100 grid-canvas flex items-center justify-center p-4 sm:p-6 md:p-10">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
        {/* Left Column: Mission & Persona Value */}
        <section className="flex flex-col gap-6">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
            <span>NESI Innovation Challenge 2026 · PowerTech Track 1</span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-5xl sm:text-6xl font-bold tracking-tight text-white">
                LUME
              </h1>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400 ring-4 ring-emerald-500/20" aria-hidden />
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-200">
              Service Accountability &amp; Smart Metering for Nigeria&apos;s Grid
            </p>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed max-w-[48ch]">
              Instead of only billing kWh consumed, Lume continuously verifies the daily supply hours feeders delivered against NERC Band A–E guarantees, enforcing the 7-Day Rule directly from telemetry.
            </p>
          </div>

          {/* Persona Value Highlights */}
          <div className="grid gap-3 pt-2 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-[#0E1524] p-3.5 shadow-sm">
              <span className="text-xs font-bold text-white">Customers</span>
              <p className="mt-1 text-[11px] text-slate-400 leading-normal">
                Audited daily supply hours alongside itemized bills &amp; automatic downgrade credits.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0E1524] p-3.5 shadow-sm">
              <span className="text-xs font-bold text-white">DisCo Operations</span>
              <p className="mt-1 text-[11px] text-slate-400 leading-normal">
                Automated theft &amp; bypass detection ranking field leads by algorithmic confidence.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0E1524] p-3.5 shadow-sm">
              <span className="text-xs font-bold text-white">Regulators</span>
              <p className="mt-1 text-[11px] text-slate-400 leading-normal">
                Feeder-level 7-Day Rule compliance reports and tamper-evident CSV evidence dockets.
              </p>
            </div>
          </div>
        </section>

        {/* Right Column: High-Contrast Light Sign-In Panel */}
        <section className="rounded-2xl border border-slate-200 bg-white p-7 sm:p-9 shadow-2xl text-slate-900">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-xl font-bold text-slate-900">Sign In to Dashboard</h2>
            <p className="mt-1 text-xs text-slate-500">Select a demo persona or authenticate with credentials</p>
          </div>

          <div className="mt-6">
            <LoginForm notice={expired ? "Your session ended. Sign in again." : null} />
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4 text-center text-[11px] text-slate-400">
            Prototype demo on simulated meter telemetry. Data sources explicitly verified.
          </div>
        </section>
      </div>
    </main>
  );
}
