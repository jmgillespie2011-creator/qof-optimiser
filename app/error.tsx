"use client";
import { useEffect } from "react";
import Link from "next/link";

// Route-level error boundary — shows a calm, professional fallback instead of a
// raw stack trace if a page throws (e.g. a transient data-fetch failure).
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface for debugging; a real deployment would send this to an error tracker.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="kicker">Something went wrong</div>
      <h1 className="mt-2 text-2xl font-bold">We couldn&apos;t load this page</h1>
      <p className="mt-2 text-slate-600">This is usually temporary. Try again, or head back to your dashboard.</p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="btn">Try again</button>
        <Link href="/dashboard" className="btn-ghost">Dashboard</Link>
      </div>
    </main>
  );
}
