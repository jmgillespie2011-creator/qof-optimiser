import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="kicker">Error 404</div>
      <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-600">The page you were looking for doesn&apos;t exist or may have moved.</p>
      <Link href="/dashboard" className="btn mt-6">Back to dashboard</Link>
    </main>
  );
}
