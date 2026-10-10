import Link from "next/link";
import type { Metadata } from "next";

import { LumeLogo } from "@/components/LumeLogo";
import { MobileMenu } from "@/components/MobileMenu";

const SITE_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#pillars", label: "Features" },
  { href: "#roles", label: "Who uses Lume" },
];

export const metadata: Metadata = {
  title: "Lume — Smart Electricity Monitoring",
  description:
    "Lume continuously verifies electricity supply hours against NERC tariff band guarantees, detects meter anomalies, and gives customers, DisCos, and regulators transparent energy data.",
};

// ── Feature Pill ─────────────────────────────────────────────────
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex self-start items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
      {children}
    </span>
  );
}

// ── Hero Illustration: Grid + Meter ──────────────────────────────
function HeroIllustration() {
  return (
    <div className="relative w-full max-w-md mx-auto mt-8 select-none" aria-hidden>
      {/* outer card */}
      <div className="rounded-2xl border-2 border-[var(--border-strong)] bg-white shadow-[8px_8px_0px_0px_rgba(26,30,41,0.12)] p-6 flex flex-col gap-5">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LumeLogo size="sm" markOnly />
            <span className="font-bold text-[var(--text-primary)] tracking-tight">Meter M0001</span>
          </div>
          <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
            ✓ Band A Met
          </span>
        </div>

        {/* Big stat */}
        <div className="flex gap-4">
          <div className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Delivered Today</p>
            <p className="mt-1 figure text-4xl font-bold text-[var(--text-primary)]">20.6<span className="text-base font-semibold text-[var(--text-muted)] ml-1">h</span></p>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">Band A promise: 20 h</p>
          </div>
          <div className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--amber-50)] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">Bill Estimate</p>
            <p className="mt-1 figure text-4xl font-bold text-amber-700">₦4,280</p>
            <p className="mt-1 text-[10px] text-amber-700">Monthly projection</p>
          </div>
        </div>

        {/* Day bars strip */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Last 7 days</p>
          <div className="flex items-end gap-1.5 h-10">
            {[21, 20.4, 18.2, 21.5, 22, 19.1, 20.6].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm"
                style={{
                  height: `${Math.round((h / 24) * 100)}%`,
                  background: h >= 20 ? "#10B981" : "#F59E0B",
                  border: "1.5px solid rgba(26,30,41,0.15)",
                }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {["M","T","W","T","F","S","S"].map((d,i) => (
              <span key={i} className="flex-1 text-center text-[9px] text-[var(--text-faint)]">{d}</span>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] text-[var(--text-muted)]">Illustration · sample data</p>

      {/* Floating badge */}
      <div className="absolute -top-9 right-4 rotate-2 rounded-xl border-2 border-[var(--border-strong)] bg-amber-400 px-3 py-1.5 shadow-[3px_3px_0px_rgba(26,30,41,0.2)]">
        <p className="text-[11px] font-black text-amber-900">⚡ Tamper alert</p>
        <p className="text-[9px] text-amber-800">Meter M0081 · open</p>
      </div>
    </div>
  );
}

// ── Pillar Card ───────────────────────────────────────────────────
type PillarProps = {
  icon: string;
  tag: string;
  title: string;
  description: string;
  accentClass: string;
  tagClass: string;
};

function PillarCard({ icon, tag, title, description, accentClass, tagClass }: PillarProps) {
  return (
    <div className={`flex flex-col gap-4 rounded-2xl border-2 border-[var(--border-strong)] bg-white p-6 shadow-[4px_4px_0px_0px_rgba(26,30,41,0.08)] transition-shadow hover:shadow-[6px_6px_0px_0px_rgba(26,30,41,0.12)]`}>
      <div className={`w-12 h-12 rounded-xl border-2 border-[var(--border-strong)] flex items-center justify-center text-2xl ${accentClass}`}>
        {icon}
      </div>
      <span className={`self-start rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase ${tagClass}`}>{tag}</span>
      <div>
        <h3 className="text-lg font-bold text-[var(--text-primary)] leading-snug">{title}</h3>
        <p className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// ── How It Works Step ─────────────────────────────────────────────
function HowStep({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-full border-2 border-[var(--border-strong)] bg-amber-400 flex items-center justify-center font-black text-amber-900 shadow-[2px_2px_0px_rgba(26,30,41,0.2)]">
        {step}
      </div>
      <div className="pt-1">
        <h4 className="font-bold text-[var(--text-primary)]">{title}</h4>
        <p className="mt-1 text-sm text-[var(--text-muted)] leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

// ── Role Card ─────────────────────────────────────────────────────
function RoleCard({ emoji, role, description, user }: { emoji: string; role: string; description: string; user: string }) {
  return (
    <Link
      href={`/login?as=${user}`}
      className="group flex flex-col gap-3 rounded-xl border-2 border-[var(--border-default)] bg-[var(--bg-subtle)] p-5 transition-all hover:border-[var(--border-strong)] hover:shadow-[4px_4px_0px_rgba(26,30,41,0.10)]"
    >
      <span className="text-2xl">{emoji}</span>
      <div>
        <p className="font-bold text-[var(--text-primary)] group-hover:text-amber-700 transition-colors">{role}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">{description}</p>
      </div>
      <span className="mt-auto text-xs font-semibold text-amber-700 group-hover:text-amber-700">Sign in as this persona →</span>
    </Link>
  );
}

// ══════════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════════
export default function LandingPage() {
  return (
    <div id="top" className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] grid-canvas">
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b-2 border-[var(--border-default)] bg-[var(--bg-canvas)]/95 backdrop-blur-sm">
        <div className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8">
          <a href="#top" aria-label="Lume home">
            <LumeLogo size="lg" />
          </a>

          <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-[var(--text-secondary)]">
            {SITE_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-[var(--text-primary)] transition-colors">{l.label}</a>
            ))}
          </div>

          <Link
            href="/login"
            className="btn-primary btn-amber hidden md:inline-flex"
            id="nav-sign-in"
          >
            Sign in
          </Link>
          <MobileMenu links={SITE_LINKS} />
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24 md:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
          {/* Left: Copy */}
          <div className="flex flex-col gap-6">
            <Pill>⚡ Energy Accountability Platform</Pill>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05]" style={{ fontFamily: "var(--font-display)" }}>
              Power your world.{" "}
              <span className="relative inline-block isolate">
                <span className="relative z-10 text-amber-700">Know your energy.</span>
                <span
                  className="absolute inset-0 -bottom-1 rounded bg-amber-200 -z-10 rotate-[-1deg]"
                  aria-hidden
                />
              </span>
            </h1>

            <p className="text-lg text-[var(--text-secondary)] leading-relaxed max-w-[48ch]">
              Lume audits every feeder&apos;s delivered supply hours against your NERC tariff band guarantee
              — automatically, continuously, and verifiably. No spreadsheets. No guessing.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/login" className="btn-primary btn-amber text-base px-6 py-3" id="hero-get-started">
                Explore Demo Dashboard
              </Link>
              <a href="#how-it-works" className="btn-ghost text-base px-6 py-3">
                See how it works ↓
              </a>
            </div>

            {/* Proof points */}
            <div className="flex flex-wrap gap-4 pt-2">
              {[
                { emoji: "🔒", label: "Tamper-evident audit log" },
                { emoji: "📊", label: "NERC 7-Day Rule monitoring" },
                { emoji: "⚡", label: "15-minute voltage telemetry" },
              ].map(({ emoji, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] font-medium">
                  <span>{emoji}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Hero illustration */}
          <div className="flex justify-center lg:justify-end">
            <HeroIllustration />
          </div>
        </div>
      </section>

      {/* ── Pillars ──────────────────────────────────────────────── */}
      <section id="pillars" className="border-t-2 border-[var(--border-default)] bg-[var(--bg-subtle)]">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-8">
          <div className="text-center mb-10">
            <Pill>What Lume does</Pill>
            <h2 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              One platform. Three perspectives.
            </h2>
            <p className="mt-3 text-[var(--text-muted)] max-w-[52ch] mx-auto text-base">
              Whether you pay a bill, manage feeders, or enforce regulation — Lume gives you the data you need, verified and instantly usable.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3" id="feature-cards">
            <PillarCard
              icon="🏠"
              tag="Customers"
              title="Know if you got what you paid for"
              description="See exactly how many hours of electricity your feeder delivered each day versus your Band A–E tariff guarantee. Automatic credit alerts when the 7-Day Rule is breached."
              accentClass="bg-emerald-100"
              tagClass="bg-emerald-100 border-emerald-300 text-emerald-700"
            />
            <PillarCard
              icon="🔍"
              tag="DisCo Operations"
              title="Catch fraud before it costs more"
              description="Algorithmic detection ranks bypass and tampering leads by confidence score. Triage open cases, investigate with evidence, and log decisions in an immutable audit trail."
              accentClass="bg-sky-100"
              tagClass="bg-sky-100 border-sky-300 text-sky-700"
            />
            <PillarCard
              icon="📋"
              tag="Regulators"
              title="Enforce the 7-Day Rule at scale"
              description="Every feeder's compliance status, downgrade eligibility, and compensation flags — machine-verified against the official NERC register. Export tamper-evident CSV dockets in one click."
              accentClass="bg-amber-100"
              tagClass="bg-amber-100 border-amber-300 text-amber-700"
            />
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────── */}
      <section id="how-it-works" className="border-t-2 border-[var(--border-default)]">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-8">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] items-start">
            <div>
              <Pill>Process</Pill>
              <h2 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                How Lume works
              </h2>
              <p className="mt-3 text-[var(--text-muted)] leading-relaxed max-w-[44ch]">
                From raw 15-minute voltage readings to enforceable compliance decisions — automatically.
              </p>

              <div className="mt-8 flex flex-col gap-6">
                <HowStep
                  step="1"
                  title="Continuous telemetry ingestion"
                  body="Meters and feeder sensors push 15-minute voltage and kWh readings. Lume ingests, validates, and stores every slot."
                />
                <HowStep
                  step="2"
                  title="Supply-hour verification"
                  body="Every feeder's daily delivered hours are calculated from verified telemetry and compared against NERC Band A–E commitments."
                />
                <HowStep
                  step="3"
                  title="Anomaly & theft detection"
                  body="Four detection rules — tamper alarms, zero readings with live supply, sudden consumption drops, and feeder-level imbalance — flag suspicious patterns automatically."
                />
                <HowStep
                  step="4"
                  title="Traceable decisions, everywhere"
                  body="Every adjudication, login, and export is written to a SHA-256 hash-chained ledger. Any retroactive change immediately breaks the chain."
                />
              </div>
            </div>

            {/* Stats block */}
            <div className="grid grid-cols-2 gap-4 lg:pt-16">
              {[
                { label: "Detection rules", value: "4", sub: "Automated anomaly checks" },
                { label: "Audit chain", value: "SHA-256", sub: "Cryptographic integrity" },
                { label: "Data granularity", value: "15 min", sub: "Per slot telemetry" },
                { label: "Tariff bands", value: "A–E", sub: "Full NERC spectrum" },
              ].map(({ label, value, sub }) => (
                <div
                  key={label}
                  className="rounded-xl border-2 border-[var(--border-strong)] bg-white p-5 shadow-[3px_3px_0px_rgba(26,30,41,0.08)]"
                >
                  <p className="figure text-3xl font-black text-[var(--text-primary)]">{value}</p>
                  <p className="mt-1 text-sm font-bold text-[var(--text-secondary)]">{label}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Who Uses Lume ─────────────────────────────────────────── */}
      <section id="roles" className="border-t-2 border-[var(--border-default)] bg-[var(--bg-subtle)]">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-8">
          <div className="text-center mb-10">
            <Pill>Access the demo</Pill>
            <h2 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              Sign in as any role
            </h2>
            <p className="mt-3 text-[var(--text-muted)] max-w-[44ch] mx-auto text-base">
              Lume runs on simulated meter telemetry. Pick a persona and explore the full platform instantly.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <RoleCard
              emoji="🏠"
              role="Customer (Band A)"
              description="A household on a Band A feeder. View supply hours, the itemised bill, and any downgrade credit."
              user="customer"
            />
            <RoleCard
              emoji="📉"
              role="Customer (Low band)"
              description="A household on the lowest-band feeder in the demo. Compare a different supply promise and bill."
              user="customer2"
            />
            <RoleCard
              emoji="🔍"
              role="DisCo Operations"
              description="Triage theft and bypass leads, run the detection algorithm, and adjudicate fraud cases."
              user="ops"
            />
            <RoleCard
              emoji="📋"
              role="NERC Regulator"
              description="Monitor feeder compliance across all bands and export tamper-evident CSV audit dockets."
              user="regulator"
            />
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section className="border-t-2 border-[var(--border-default)]">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-8 text-center flex flex-col items-center gap-6">
          <LumeLogo size="xl" markOnly />
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Ready to see your grid clearly?
          </h2>
          <p className="text-[var(--text-muted)] max-w-[42ch] text-base leading-relaxed">
            No installation needed. The demo runs entirely on simulated data — explore every feature right now.
          </p>
          <Link href="/login" className="btn-primary btn-amber text-base px-8 py-3.5" id="cta-get-started">
            Open Demo Dashboard
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t-2 border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <LumeLogo size="sm" />
            </div>

            <nav className="flex flex-wrap gap-6 text-sm text-[var(--text-muted)]" aria-label="Footer navigation">
              <a href="#pillars" className="hover:text-[var(--text-primary)] transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-[var(--text-primary)] transition-colors">How it works</a>
              <Link href="/login" className="hover:text-[var(--text-primary)] transition-colors">Sign in</Link>
            </nav>

            <p className="text-xs text-[var(--text-muted)]">
              Demo environment — all meter readings are simulated.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
