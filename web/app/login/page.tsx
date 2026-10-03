import { redirect } from "next/navigation";

import { getUser, HOME } from "@/lib/session";

import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getUser().catch(() => null);
  if (user) redirect(HOME[user.role]);
  const { expired } = await searchParams;

  return (
    <main className="mx-auto grid min-h-screen max-w-5xl items-center gap-12 px-4 py-12 md:grid-cols-[1.2fr_1fr] md:px-8">
      <section>
        <h1 className="figure text-7xl text-ink md:text-8xl">Lume</h1>
        <p className="mt-6 max-w-[34ch] text-xl leading-snug text-ink-2">
          Every electricity bill, checked against the hours of power the feeder actually delivered.
        </p>
        <dl className="mt-10 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="font-semibold">Customers</dt>
          <dd className="text-ink-2">see their bill next to the supply their Band promised</dd>
          <dt className="font-semibold">DisCo teams</dt>
          <dd className="text-ink-2">review theft leads and feeder losses</dd>
          <dt className="font-semibold">Regulators</dt>
          <dd className="text-ink-2">get 7-Day Rule evidence for every feeder</dd>
        </dl>
      </section>
      <section className="rounded-lg border border-rule bg-surface p-6 md:p-8">
        <h2 className="text-lg font-semibold">Sign in</h2>
        <div className="mt-6">
          <LoginForm notice={expired ? "Your session ended. Sign in again." : null} />
        </div>
        <p className="mt-6 border-t border-rule pt-4 text-sm text-muted">
          Demo accounts: <strong className="font-semibold text-ink-2">customer</strong>,{" "}
          <strong className="font-semibold text-ink-2">ops</strong>,{" "}
          <strong className="font-semibold text-ink-2">regulator</strong>. All readings are simulated.
        </p>
      </section>
    </main>
  );
}
