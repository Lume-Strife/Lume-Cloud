import Link from "next/link";
import type { Metadata } from "next";
import { LumeLogo } from "@/components/LumeLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy and Google API Services User Data disclosure for Lume Cloud.",
};

export default function PrivacyPolicyPage() {
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
        {/* Title & Badge */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            <span>Official Policy</span>
            <span className="text-amber-400">•</span>
            <span>Google API Compliant</span>
          </div>
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-base text-[var(--text-secondary)]">
            Last updated: <time dateTime="2026-10-14">October 14, 2026</time>
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Applies to Lume Cloud (&quot;Lume&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;), accessible via{" "}
            <a
              href="https://lume-cloud.vercel.app"
              className="underline decoration-amber-500 underline-offset-2 hover:text-amber-700"
            >
              lume-cloud.vercel.app
            </a>{" "}
            and connected authorized domains.
          </p>
        </div>

        {/* Highlight Box: Google API Services User Data Policy / Limited Use */}
        <section className="mb-12 rounded-2xl border-2 border-[var(--border-strong)] bg-amber-50/70 p-6 shadow-[var(--shadow-card)] dark:bg-amber-950/20 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-xl font-bold text-black shadow-sm">
              🛡️
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                Google API Services User Data &amp; Limited Use Disclosure
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                Lume Cloud adheres strictly to Google&apos;s API Services User Data Policy. Lume&apos;s use
                and transfer to any other app of information received from Google APIs will adhere to the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline decoration-amber-500 underline-offset-2 hover:text-amber-700"
                >
                  Google API Services User Data Policy
                </a>
                , including the <strong>Limited Use</strong> requirements.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-[var(--text-secondary)]">
                <li>• <strong>No Data Selling:</strong> We never sell Google user data or Google Ads data to third parties or brokers.</li>
                <li>• <strong>No Unauthorized Advertising:</strong> We never use or transfer Google user data for serving third-party ads, retargeting, or credit scoring.</li>
                <li>• <strong>No Model Training:</strong> We do not use Google user data to train generalized AI/ML models without affirmative user consent.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Policy Body */}
        <div className="space-y-10 text-[var(--text-secondary)] leading-relaxed">
          {/* Section 1 */}
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              1. Overview and Purpose
            </h2>
            <p className="mt-3 text-sm">
              Lume Cloud provides intelligent electricity verification, billing accountability, utility service
              monitoring, and campaign management analytics. This Privacy Policy details our practices
              regarding the collection, use, retention, and protection of personal data and data accessed
              through third-party integrations, specifically Google APIs (such as Google OAuth and the Google Ads API).
            </p>
            <p className="mt-3 text-sm">
              By using Lume Cloud or linking your Google account, you acknowledge and agree to the data collection
              and processing practices described in this document.
            </p>
          </section>

          {/* Section 2 */}
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              2. Google User Data and Google Ads API Data
            </h2>
            <p className="mt-3 text-sm">
              When you authenticate with Google or connect your Google Ads account to Lume Cloud, we request access
              only to the minimum necessary scopes required to deliver our service:
            </p>

            <div className="mt-5 space-y-4 text-sm">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4">
                <h3 className="font-semibold text-[var(--text-primary)]">A. Authentication &amp; Basic Profile</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Scopes: <code>openid</code>, <code>email</code>, <code>profile</code>
                </p>
                <p className="mt-2 text-xs leading-relaxed">
                  We use your Google profile information (such as your verified email address, name, and profile identifier)
                  to verify your identity, secure your user session, and associate your workspace configuration with your account.
                </p>
              </div>

              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4">
                <h3 className="font-semibold text-[var(--text-primary)]">B. Google Ads API Data</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Scopes: <code>https://www.googleapis.com/auth/adwords</code>
                </p>
                <p className="mt-2 text-xs leading-relaxed">
                  When you connect Google Ads to Lume Cloud, our platform accesses advertising account information
                  such as campaign names, status, impressions, clicks, cost, conversions, performance metrics, and ad group data.
                  This data is used solely to:
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
                  <li>Display synchronized marketing and utility campaign performance reports within your Lume Cloud dashboard.</li>
                  <li>Calculate advertising efficiency and conversion metrics for service outreach initiatives.</li>
                  <li>Correlate public awareness campaigns with utility service band updates and consumer engagement.</li>
                  <li>Provide automated or scheduled performance summaries to authorized team members.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              3. Information Collected from Other Sources
            </h2>
            <p className="mt-3 text-sm">
              In addition to Google user data, Lume Cloud processes:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm">
              <li><strong>Telemetry and Meter Data:</strong> Voltage readings, energy consumption (kWh), and feeder telemetry submitted via secured API endpoints for service accountability.</li>
              <li><strong>Account Credentials:</strong> Usernames, hashed credentials, and role authorizations (e.g., customer, operations, regulator).</li>
              <li><strong>Audit Records:</strong> Tamper-evident, hash-chained logs of decisions, exports, and administrative actions for regulatory transparency.</li>
              <li><strong>Technical Logs:</strong> IP addresses, browser user-agent strings, and diagnostic timestamps for security monitoring and rate limiting.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              4. Data Storage, Retention, and Security
            </h2>
            <p className="mt-3 text-sm">
              We implement comprehensive technical, administrative, and physical safeguards to ensure the confidentiality
              and integrity of your data:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm">
              <li><strong>Encryption in Transit:</strong> All communications between your browser, our servers, and Google APIs are encrypted using modern Transport Layer Security (TLS 1.2 / TLS 1.3).</li>
              <li><strong>Encryption at Rest:</strong> Sensitive authentication tokens and database records are encrypted at rest using AES-256 standard encryption.</li>
              <li><strong>Access Control:</strong> OAuth access tokens and refresh tokens are stored in secured credential vaults with strict role-based access control (RBAC). Employees and automated processes cannot access raw Google credentials without authorized administrative clearance.</li>
              <li><strong>Retention Policy:</strong> Google Ads reporting data and temporary session tokens are retained only for the duration required to provide active dashboard reporting and analysis. When an account or integration is disconnected, all associated OAuth tokens and cached metrics are permanently deleted within 30 days.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              5. How We Share or Disclose Data
            </h2>
            <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
              Lume Cloud does NOT sell, rent, monetize, or trade your personal data or Google user data.
            </p>
            <p className="mt-2 text-sm">
              We only disclose information under the following limited circumstances:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm">
              <li><strong>Authorized Service Providers:</strong> Trusted infrastructure sub-processors (e.g., cloud hosting providers such as AWS and Vercel) bound by strict confidentiality and data protection agreements.</li>
              <li><strong>Legal Compliance:</strong> When strictly required to comply with a valid court order, regulation, or mandatory government request under applicable law.</li>
              <li><strong>With Your Consent:</strong> When you explicitly instruct or authorize us to share information with a third party.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              6. Your Rights, Access Revocation, and Data Deletion
            </h2>
            <p className="mt-3 text-sm">
              You retain full control over your personal data and third-party account authorizations:
            </p>

            <div className="mt-5 space-y-4 text-sm">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4">
                <h3 className="font-semibold text-[var(--text-primary)]">
                  How to Revoke Lume&apos;s Access to Google Data
                </h3>
                <p className="mt-2 text-xs leading-relaxed">
                  You can immediately disconnect Lume Cloud and revoke access to your Google account and Google Ads
                  at any time directly through Google&apos;s security settings:
                </p>
                <div className="mt-3">
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border-2 border-[var(--border-strong)] bg-amber-400 px-4 py-2 text-xs font-bold text-black shadow-sm transition hover:bg-amber-300"
                  >
                    Manage Google Account Permissions ↗
                  </a>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4">
                <h3 className="font-semibold text-[var(--text-primary)]">
                  Request Data Deletion
                </h3>
                <p className="mt-2 text-xs leading-relaxed">
                  To request the complete deletion of your account, associated telemetry, or stored Google Ads data
                  from our systems, contact our privacy team at{" "}
                  <a
                    href="mailto:privacy@lume-cloud.vercel.app"
                    className="font-medium underline decoration-amber-500 hover:text-amber-700"
                  >
                    privacy@lume-cloud.vercel.app
                  </a>
                  . We will process your request within 7 business days and confirm full purge.
                </p>
              </div>
            </div>
          </section>

          {/* Section 7 */}
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              7. Children&apos;s Privacy
            </h2>
            <p className="mt-3 text-sm">
              Lume Cloud is a utility infrastructure, business analytics, and developer platform not directed
              at children under 18 years of age. We do not knowingly collect personal information from minors.
            </p>
          </section>

          {/* Section 8 */}
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              8. Changes to This Privacy Policy
            </h2>
            <p className="mt-3 text-sm">
              We may update this Privacy Policy from time to time to reflect operational improvements,
              regulatory updates, or changes in third-party API requirements. The &quot;Last updated&quot; date at
              the top of this page indicates the effective date of the latest revisions.
            </p>
          </section>

          {/* Section 9 */}
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              9. Contact Information
            </h2>
            <p className="mt-3 text-sm">
              If you have any questions, feedback, or data requests regarding this Privacy Policy or our compliance
              with Google API user data standards, please contact us:
            </p>
            <div className="mt-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4 text-sm">
              <p><strong>Platform:</strong> Lume Cloud</p>
              <p className="mt-1"><strong>Primary URL:</strong> <a href="https://lume-cloud.vercel.app" className="underline hover:text-amber-700">https://lume-cloud.vercel.app</a></p>
              <p className="mt-1"><strong>Privacy &amp; Compliance Email:</strong> <a href="mailto:privacy@lume-cloud.vercel.app" className="underline hover:text-amber-700">privacy@lume-cloud.vercel.app</a></p>
              <p className="mt-1"><strong>Support Email:</strong> <a href="mailto:support@lume-cloud.vercel.app" className="underline hover:text-amber-700">support@lume-cloud.vercel.app</a></p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] py-8 text-center text-xs text-[var(--text-muted)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 md:px-8">
          <LumeLogo size="sm" />
          <div className="flex gap-6">
            <Link href="/" className="hover:text-[var(--text-primary)]">Home</Link>
            <Link href="/privacy" className="font-semibold text-amber-700 dark:text-amber-400">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[var(--text-primary)]">Terms of Service</Link>
          </div>
          <p>© {new Date().getFullYear()} Lume Cloud. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
