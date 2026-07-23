import Link from "next/link";
import { loginAction } from "./actions";
export const dynamic = "force-dynamic";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <Link href="/" className="text-nhs-blue">← QOF Optimiser</Link>
      <h1 className="mt-4 text-2xl font-bold">Sign in</h1>
      {sp.error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-nhs-red">{sp.error}</p>}
      <form action={loginAction} className="mt-6 space-y-4">
        <div><label className="label">Email</label><input name="email" type="email" required className="input" /></div>
        <div><label className="label">Password</label><input name="password" type="password" required className="input" /></div>
        <button className="btn w-full" type="submit">Sign in</button>
      </form>
      <p className="mt-4 text-sm text-slate-600">No account? <Link href="/register" className="text-nhs-blue">Register free</Link></p>
    </main>
  );
}
