import Link from "next/link";
import RegisterForm from "./RegisterForm";
export const dynamic = "force-dynamic";
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <Link href="/" className="text-nhs-blue">← QOF Optimiser</Link>
      <h1 className="mt-4 text-2xl font-bold">Create your free account</h1>
      <p className="mt-1 text-slate-600">Free during launch. No card required.</p>
      {sp.error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-nhs-red">{sp.error}</p>}
      <div className="mt-6"><RegisterForm /></div>
      <p className="mt-4 text-sm text-slate-600">Already have an account? <Link href="/login" className="text-nhs-blue">Sign in</Link></p>
    </main>
  );
}
