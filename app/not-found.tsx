import Link from "next/link";
export default function NotFound() {
  return <main className="mx-auto max-w-md px-6 py-20 text-center"><h1 className="text-2xl font-bold">Not found</h1><Link href="/dashboard" className="btn mt-4">Back to dashboard</Link></main>;
}
