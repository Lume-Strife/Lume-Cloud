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
            className={`flex min-h-10 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-all md:min-h-0 md:flex-none md:py-1.5 ${
              current
                ? "bg-amber-100 text-amber-800 border border-amber-300"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] border border-transparent"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
