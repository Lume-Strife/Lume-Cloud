"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1 text-sm">
      {links.map((l) => {
        const current = path === l.href || path.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={current ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold transition ${
              current
                ? "bg-[#162032] text-emerald-400 border border-emerald-500/30 shadow-xs"
                : "text-slate-400 hover:bg-[#111A2B] hover:text-slate-200 border border-transparent"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
