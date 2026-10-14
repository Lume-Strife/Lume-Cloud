import Link from "next/link";
import type { Metadata } from "next";
import { LumeLogo } from "@/components/LumeLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Lume Cloud utility intelligence and marketing integrations.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 md:px-8">
          <Link href="/" aria-label="Lume Home" className="flex items-center gap-2">
            <LumeLogo size="lg" />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
            >
              ← Back to App
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-12 md:px-8 md:py-16">
        {/* Title */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            <span>Legal Agreement</span>
            <span className="text-amber-400">•</span>
            <span>Terms of Use</span>
          </div>
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-3 text-base text-[var(--text-secondary)]">
            Last updated: <time dateTime="2026-10-14">October 14, 2026</time>
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            These Terms govern your access to and use of Lume Cloud (&quot;Lume&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;),
            available at{" "}
            <a
              href="https://lume-cloud.vercel.app"
              className="underline decoration-amber-500 underline-offset-2 hover:text-amber-700"
            >
              lume-cloud.vercel.app
            </a>.
          </p>
        </div>

        <div className="space-y-10 text-[var(--text-secondary)] leading-relaxed">
          {/* Section 1 */}
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              1. Agreement to Terms
            </h2>
            <p className="mt-3 text-sm">
              By accessing, browsing, registering an account, or connecting third-party services to Lume Cloud,
              you acknowledge that you have read, understood, and agree to be bound by these Terms of Service
              and our Privacy Policy. If you do not agree to these terms, you must not use or access the service.
            </p>
          </section>

          {/* Section 2 */}
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              2. Description of Service
            </h2>
            <p className="mt-3 text-sm">
              Lume Cloud provides a cloud-based energy intelligence, electricity supply verification, regulatory compliance,
              and advertising reporting platform. Core capabilities include:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm">
              <li>Ingesting feeder and meter telemetry to verify delivered hours of electricity against regulatory band commitments.</li>
              <li>Calculating automated billing adjustments, supply-backed estimation, and downgrade credit recommendations.</li>
              <li>Providing audit-logged, tamper-evident records for DisCo operations, regulators, and consumers.</li>
              <li>Connecting to third-party APIs (including the Google Ads API) to monitor advertising performance and public service outreach campaigns.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              3. Third-Party Integrations &amp; Google APIs
            </h2>
            <p className="mt-3 text-sm">
              Lume Cloud offers optional integrations with third-party platforms, such as Google OAuth and the Google Ads API.
              When using these features:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm">
              <li>You represent and warrant that you hold all necessary administrative permissions and rights to authorize Lume Cloud to access the respective third-party account.</li>
              <li>Your use of Google APIs is subject to Google&apos;s Terms of Service and API policies.</li>
              <li>Lume Cloud handles Google user data in strict adherence to the Google API Services User Data Policy, including the Limited Use requirements.</li>
              <li>You may revoke Lume Cloud&apos;s access at any time via your Google Account security permissions.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              4. User Accounts and Responsibilities
            </h2>
            <p className="mt-3 text-sm">
              To use certain features of the platform, you may be required to register or authenticate. You agree to:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm">
              <li>Provide accurate, current, and complete registration information.</li>
              <li>Safeguard and maintain the confidentiality of your credentials and API keys.</li>
              <li>Promptly notify Lume Cloud of any unauthorized use or security incident affecting your account.</li>
              <li>Take full responsibility for all activities conducted under your credentials.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              5. Acceptable Use Policy
            </h2>
            <p className="mt-3 text-sm">You agree NOT to:</p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm">
              <li>Use the platform for any fraudulent, deceptive, or illegal activities.</li>
              <li>Interfere with, overburden, or compromise the integrity or security of our networks and APIs.</li>
              <li>Attempt to reverse-engineer, decompile, or access source code beyond permitted interfaces.</li>
              <li>Misrepresent simulated data or demonstration readings as certified commercial utility billing.</li>
              <li>Extract or harvest personal information without proper authorization.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              6. Intellectual Property
            </h2>
            <p className="mt-3 text-sm">
              All software, algorithms, trademarks, visual marks, documentation, and user interfaces comprising Lume Cloud
              are the proprietary property of Lume and its licensors. Except as expressly authorized, no portion of the
              service may be copied, reproduced, distributed, or modified.
            </p>
          </section>

          {/* Section 7 */}
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              7. Disclaimers and Limitation of Liability
            </h2>
            <p className="mt-3 text-sm">
              Lume Cloud is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind,
              express or implied. To the maximum extent permitted by applicable law, Lume Cloud and its operators shall
              not be liable for any indirect, incidental, consequential, special, or punitive damages, including loss of profits,
              data, goodwill, or operational interruptions.
            </p>
          </section>

          {/* Section 8 */}
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              8. Contact Us
            </h2>
            <p className="mt-3 text-sm">
              If you have any questions about these Terms of Service, please reach out to our team at{" "}
              <a
                href="mailto:support@lume-cloud.vercel.app"
                className="font-medium underline decoration-amber-500 hover:text-amber-700"
              >
                support@lume-cloud.vercel.app
              </a>.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] py-8 text-center text-xs text-[var(--text-muted)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 md:px-8">
          <LumeLogo size="sm" />
          <div className="flex gap-6">
            <Link href="/" className="hover:text-[var(--text-primary)]">Home</Link>
            <Link href="/privacy" className="hover:text-[var(--text-primary)]">Privacy Policy</Link>
            <Link href="/terms" className="font-semibold text-amber-700 dark:text-amber-400">Terms of Service</Link>
          </div>
          <p>© {new Date().getFullYear()} Lume Cloud. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
