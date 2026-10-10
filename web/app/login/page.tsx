import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";

import { LumeLogo } from "@/components/LumeLogo";
import { getUser, HOME } from "@/lib/session";
import { LoginForm } from "./LoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
};

type PageProps = {
  searchParams: Promise<{ expired?: string; as?: string }>;
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps) {
  const user = await getUser().catch(() => null);
  if (user) redirect(HOME[user.role]);
  const { expired, as } = await searchParams;

  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Pylons at sunset. The source is small, so it is softened slightly and tinted for contrast. */}
      <Image
        src="/login-bg.avif"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 scale-105 object-cover blur-[2px]"
      />
      <div aria-hidden className="login-tint absolute inset-0 -z-10" />

      <section className="card-comic w-full max-w-md p-7 sm:p-8">
        <Link href="/" aria-label="Lume home" className="inline-block">
          <LumeLogo size="lg" />
        </Link>
        <h1 className="mt-6 font-display text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Pick a demo account, or enter a username and password.</p>

        <div className="mt-6">
          <LoginForm notice={expired ? "Your session ended. Please sign in again." : null} initialUser={as ?? null} />
        </div>
      </section>

      <p className="mt-6 rounded-full bg-black/45 px-3 py-1 text-center text-xs text-[#F3EFE7] backdrop-blur-sm">
        Readings in this demo are simulated.
      </p>
    </main>
  );
}
