import Link from "next/link";
import type { Metadata } from "next";

import { BulbBuddy } from "@/components/BulbBuddy";
import { LumeLogo } from "@/components/LumeLogo";
import { MobileMenu } from "@/components/MobileMenu";
import { ScrollReveal } from "@/components/ScrollReveal";
import { Splash } from "@/components/Splash";

export const metadata: Metadata = {
  title: "Lume: electricity supply you can check",
};

const SITE_LINKS = [
  { href: "#who", label: "Who it's for" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#demo", label: "Demo" },
];

const AUDIENCES = [
  {
    name: "Customers",
    body: "See how many hours of power you actually got each day, right next to your bill. If your feeder misses its band seven days in a row, Lume works out the credit you're owed.",
  },
  {
    name: "DisCo operations",
    body: "Get a ranked list of meters worth a field visit: tamper alarms, zero readings while the feeder was live, sudden drops in use, and energy lost between the feeder and its meters.",
  },
  {
    name: "Regulators",
    body: "Check every feeder against its band and the 7-Day Rule in one place, and download the evidence as a CSV.",
  },
];

const STEPS = [
  {
    title: "Readings come in",
    body: "Meters and feeder sensors report voltage and energy use every 15 minutes.",
  },
  {
    title: "Supply hours are counted",
    body: "A 15-minute slot counts as supplied when feeder voltage is above 180V. Days with too little data are marked as gaps, never as outages.",
  },
  {
    title: "Bands are checked and bills are built",
    body: "Each day is compared with the feeder's NERC band. Bills only charge for energy when supply can be shown.",
  },
  {
    title: "Unusual meters are flagged",
    body: "Four checks look for signs of tampering or bypass. Each flag is a lead for a site visit, not a verdict.",
  },
];

/** Staggers sibling reveals so a row of items arrives left to right. */
const delay = (i: number) =>
  ({ "--reveal-delay": `${i * 90}ms` }) as React.CSSProperties;

const DEMO_ACCOUNTS = [
  { user: "customer", name: "Customer on a Band A feeder" },
  { user: "customer2", name: "Customer on the lowest-band feeder" },
  { user: "ops", name: "DisCo operations" },
  { user: "regulator", name: "Regulator" },
];

/** A sample of what a customer sees. Clearly labelled; none of these numbers are live. */
function SampleCard() {
  const days = [21, 20.4, 18.2, 21.5, 22, 19.1, 20.6];
  return (
    <figure className="mx-auto w-full max-w-sm select-none" aria-hidden>
      <div className="card-comic p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Meter M0001</span>
          <span className="text-xs font-medium text-emerald-700">
            Band A kept
          </span>
        </div>
        <p className="mt-5 text-xs text-[var(--text-muted)]">Power today</p>
        <p className="figure mt-1 text-5xl">
          20.6
          <span className="ml-1 text-lg font-semibold text-[var(--text-muted)]">
            hours
          </span>
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Band A promises 20 hours a day
        </p>
        <div className="mt-6 flex h-14 items-end gap-1.5">
          {days.map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-sm ${h >= 20 ? "bg-emerald-500" : "bg-amber-400"}`}
              style={{ height: `${Math.round((h / 24) * 100)}%` }}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">Last 7 days</p>
      </div>
      <figcaption className="mt-3 text-center text-xs text-[var(--text-muted)]">
        Sample data
      </figcaption>
    </figure>
  );
}

export default function LandingPage() {
  return (
    <div
      id="top"
      className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]"
    >
      <Splash />
      <ScrollReveal />

      <nav className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/95 backdrop-blur-sm">
        <div className="relative mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:px-8">
          <a href="#top" aria-label="Lume home">
            <LumeLogo size="lg" />
          </a>
          <div className="hidden items-center gap-7 text-sm text-[var(--text-secondary)] md:flex">
            {SITE_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="transition-colors hover:text-[var(--text-primary)]"
              >
                {l.label}
              </a>
            ))}
          </div>
          <Link
            href="/login"
            className="btn-primary btn-amber hidden md:inline-flex"
          >
            Sign in
          </Link>
          <MobileMenu links={SITE_LINKS} />
        </div>
      </nav>

      <main>
        <section className="mx-auto grid max-w-5xl items-center gap-14 px-4 py-20 md:px-8 md:py-28 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
              Did your feeder deliver the{" "}
              <span className="underline decoration-amber-400 decoration-[0.14em] underline-offset-[0.12em]">
                power
              </span>{" "}
              you paid for?
            </h1>
            <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-[var(--text-secondary)]">
              Lume counts the hours of electricity each feeder delivers and
              checks them against its NERC band. Customers see it next to their
              bill. DisCos and the regulator see it for every feeder.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Link
                href="/login"
                className="btn-primary btn-amber px-6 py-3 text-base"
              >
                Try the demo
              </Link>
              <a
                href="#how-it-works"
                className="text-sm font-semibold text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--text-primary)] hover:underline"
              >
                How it works
              </a>
            </div>
          </div>
          <BulbBuddy />
        </section>

        <section id="who" className="border-t border-[var(--border-subtle)]">
          <div className="mx-auto max-w-5xl px-4 py-20 md:px-8">
            <h2 className="reveal font-display text-3xl font-bold tracking-tight">
              Who it&apos;s for
            </h2>
            <div className="mt-10 grid gap-10 md:grid-cols-3">
              {AUDIENCES.map((a, i) => (
                <div key={a.name} className="reveal" style={delay(i)}>
                  <div className="audience">
                    <h3 className="font-semibold">{a.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {a.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="border-t border-[var(--border-subtle)]"
        >
          <div className="mx-auto max-w-5xl px-4 py-20 md:px-8">
            <h2 className="reveal font-display text-3xl font-bold tracking-tight">
              How it works
            </h2>
            <ol className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-2">
              {STEPS.map((s, i) => (
                <li key={s.title} className="reveal" style={delay(i)}>
                  <div className="step flex gap-4">
                    <span className="step-num flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[var(--border-strong)] bg-amber-300 text-sm font-bold">
                      {i + 1}
                    </span>
                    <div className="step-body">
                      <h3 className="font-semibold">{s.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                        {s.body}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <p className="reveal mt-12 max-w-[60ch] text-sm leading-relaxed text-[var(--text-secondary)]">
              Every sign-in, decision and export is written to an audit log.
              Each entry is chained to the one before it, so an edit after the
              fact shows up.
            </p>
          </div>
        </section>

        <section id="demo" className="border-t border-[var(--border-subtle)]">
          <div className="mx-auto max-w-5xl px-4 py-20 md:px-8">
            <h2 className="reveal font-display text-3xl font-bold tracking-tight">
              Try it
            </h2>
            <p className="reveal mt-3 max-w-[52ch] text-[var(--text-secondary)]">
              The demo runs on simulated readings. Pick an account to sign in
              as.
            </p>
            <div className="mt-8 grid items-start gap-12 lg:grid-cols-[1fr_auto]">
              <ul className="reveal max-w-xl divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
                {DEMO_ACCOUNTS.map((a) => (
                  <li key={a.user}>
                    <Link
                      href={`/login?as=${a.user}`}
                      className="group flex items-center justify-between py-4 font-medium transition-colors hover:text-amber-800"
                    >
                      {a.name}
                      <span
                        aria-hidden
                        className="text-[var(--text-muted)] transition-transform group-hover:translate-x-1 group-hover:text-amber-800"
                      >
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="reveal" style={delay(1)}>
                <SampleCard />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border-subtle)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-[var(--text-muted)] md:px-8">
          <LumeLogo size="sm" />
          <p>Readings in this demo are simulated.</p>
        </div>
      </footer>
    </div>
  );
}
