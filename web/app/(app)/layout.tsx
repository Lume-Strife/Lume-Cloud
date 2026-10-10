import Link from "next/link";
import { redirect } from "next/navigation";

import { LumeLogo } from "@/components/LumeLogo";
import { NavLinks } from "@/components/NavLinks";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getUser, HOME } from "@/lib/session";
import type { Role } from "@/lib/types";

import { signOut } from "../actions";

const NAV: Record<Role, { href: string; label: string }[]> = {
  customer: [{ href: "/customer", label: "Supply and bill" }],
  operations: [
    { href: "/operations", label: "Feeders and leads" },
    { href: "/audit", label: "Audit log" },
  ],
  regulator: [
    { href: "/regulator", label: "Compliance" },
    { href: "/audit", label: "Audit log" },
  ],
};

const ROLE_BADGE: Record<Role, { label: string; badgeClass: string }> = {
  customer: {
    label: "Customer",
    badgeClass:
      "bg-emerald-100 text-emerald-800 border border-emerald-300",
  },
  operations: {
    label: "DisCo operations",
    badgeClass:
      "bg-sky-100 text-sky-800 border border-sky-300",
  },
  regulator: {
    label: "Regulator",
    badgeClass:
      "bg-amber-100 text-amber-800 border border-amber-300",
  },
};

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  if (!user) redirect("/login");

  const badge = ROLE_BADGE[user.role] ?? {
    label: user.role,
    badgeClass: "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-default)]",
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* ── App Navigation Shell ─────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b-2 border-[var(--border-default)] bg-[var(--bg-canvas)]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 md:px-8">
          {/* Left: Brand + Navigation */}
          <div className="flex items-center gap-6">
            <Link href={HOME[user.role]} aria-label="Lume home">
              <LumeLogo size="md" />
            </Link>

            <NavLinks links={NAV[user.role]} />
          </div>

          {/* Right: Role badge + user + sign out */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-tight ${badge.badgeClass}`}
              >
                {badge.label}
              </span>
              <span className="font-medium text-[var(--text-muted)] hidden sm:inline">
                {user.display_name}
              </span>
            </div>
            <ThemeToggle />
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border-2 border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] active:scale-[0.98]"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ── Page content ─────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8 md:py-10">
        {children}
      </main>

      {/* ── App Footer ───────────────────────────────────────────── */}
      <footer className="border-t-2 border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 text-xs text-[var(--text-muted)] md:px-8">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full bg-emerald-500"
              aria-hidden
            />
            <span className="font-medium">Lume</span>
          </div>
          <p className="max-w-[50ch] text-[var(--text-faint)]">
            Meter readings are simulated. Official NERC feeder register entries transcribed from the September 2026 IBEDC publication.
          </p>
        </div>
      </footer>
    </div>
  );
}
