import Link from "next/link";
import { redirect } from "next/navigation";
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-canvas)] px-4 py-12">
      <Link href="/" aria-label="Lume home" className="mb-8">
        <LumeLogo size="xl" />
      </Link>

      <section className="card-comic w-full max-w-md p-7 sm:p-8">
        <h1 className="font-display text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Pick a demo account, or enter a username and password.</p>

        <div className="mt-6">
          <LoginForm notice={expired ? "Your session ended. Please sign in again." : null} initialUser={as ?? null} />
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-[var(--text-muted)]">Readings in this demo are simulated.</p>
    </main>
  );
}
