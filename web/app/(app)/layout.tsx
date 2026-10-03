import Link from "next/link";
import { redirect } from "next/navigation";

import { NavLinks } from "@/components/NavLinks";
import { getUser, HOME } from "@/lib/session";
import type { Role } from "@/lib/types";

import { signOut } from "../actions";

const NAV: Record<Role, { href: string; label: string }[]> = {
  customer: [{ href: "/customer", label: "My supply and bill" }],
  operations: [
    { href: "/operations", label: "Feeders and cases" },
    { href: "/audit", label: "Audit trail" },
  ],
  regulator: [
    { href: "/regulator", label: "Feeder compliance" },
    { href: "/audit", label: "Audit trail" },
  ],
};

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-rule bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3 md:px-8">
          <Link href={HOME[user.role]} className="figure text-2xl text-ink">
            Lume
          </Link>
          <NavLinks links={NAV[user.role]} />
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="text-ink-2">{user.display_name}</span>
            <form action={signOut}>
              <button type="submit" className="rounded-md border border-rule-strong px-3 py-1.5 font-medium hover:bg-paper">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8 md:py-10">{children}</main>
      <footer className="border-t border-rule">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted md:px-8">
          Demo on simulated meter and feeder data. Tariffs are placeholders until confirmed against the DisCo&apos;s
          NERC-approved rates.
        </p>
      </footer>
    </div>
  );
}
