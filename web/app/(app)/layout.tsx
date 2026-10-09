import Link from "next/link";
import { redirect } from "next/navigation";

import { NavLinks } from "@/components/NavLinks";
import { getUser, HOME } from "@/lib/session";
import type { Role } from "@/lib/types";

import { signOut } from "../actions";

const NAV: Record<Role, { href: string; label: string }[]> = {
  customer: [{ href: "/customer", label: "Supply & Bill" }],
  operations: [
    { href: "/operations", label: "Feeders & Theft Leads" },
    { href: "/audit", label: "Audit Trail" },
  ],
  regulator: [
    { href: "/regulator", label: "Feeder Compliance" },
    { href: "/audit", label: "Audit Trail" },
  ],
};

const ROLE_BADGE: Record<Role, { label: string; badgeClass: string }> = {
  customer: {
    label: "Customer Portal",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25",
  },
  operations: {
    label: "DisCo Operations",
    badgeClass: "bg-sky-500/10 text-sky-400 border border-sky-500/25",
  },
  regulator: {
    label: "NERC Regulator",
    badgeClass: "bg-purple-500/10 text-purple-400 border border-purple-500/25",
  },
};

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  if (!user) redirect("/login");

  const badge = ROLE_BADGE[user.role] ?? {
    label: user.role,
    badgeClass: "bg-slate-800 text-slate-300 border border-slate-700",
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#090D16] text-slate-100 grid-canvas">
      {/* Sticky Dark Intelligence Navigation Shell */}
      <header className="sticky top-0 z-40 border-b border-[#1E293B] bg-[#0B101B]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 md:px-8">
          <div className="flex items-center gap-7">
            {/* Typographic Wordmark with Restrained Electric-Lime Indicator */}
            <Link
              href={HOME[user.role]}
              className="group flex items-center gap-2.5 tracking-tight transition-opacity hover:opacity-90"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-lg font-bold tracking-tight text-white">LUME</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400 ring-2 ring-emerald-500/20" aria-hidden />
              </div>
              <span className="hidden sm:inline font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Grid Intelligence
              </span>
            </Link>

            <NavLinks links={NAV[user.role]} />
          </div>

          <div className="flex items-center gap-3.5 text-xs">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-tight ${badge.badgeClass}`}>
                {badge.label}
              </span>
              <span className="font-medium text-slate-400 hidden sm:inline">{user.display_name}</span>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-[#334155] bg-[#0E1524] px-3 py-1.5 font-medium text-slate-300 hover:border-slate-400 hover:text-white transition active:scale-[0.98]"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8 md:py-10">{children}</main>

      <footer className="border-t border-[#1E293B] bg-[#080C14]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-slate-500 md:px-8">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-medium text-slate-400">
              NESI Innovation Challenge 2026 (PowerTech Track 1) · Automated Service Accountability Prototype
            </span>
          </div>
          <p className="max-w-[50ch] text-slate-500">
            Meter readings are simulated. Official NERC feeder register entries transcribed from September 2026 IBEDC publication.
          </p>
        </div>
      </footer>
    </div>
  );
}
