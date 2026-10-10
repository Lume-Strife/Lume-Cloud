import Link from "next/link";

import { LumeLogo } from "@/components/LumeLogo";

export default function NotFound() {
  return (
    <main className="grid-canvas flex min-h-screen items-center justify-center p-4">
      <div className="card-comic flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
        <LumeLogo size="xl" markOnly />
        <h1 className="text-2xl font-black tracking-tight">This page is in the dark</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          The page you asked for doesn&apos;t exist, or the case or feeder it pointed to is no longer available.
        </p>
        <Link href="/" className="btn-primary btn-amber mt-2">
          Back to Lume
        </Link>
      </div>
    </main>
  );
}
