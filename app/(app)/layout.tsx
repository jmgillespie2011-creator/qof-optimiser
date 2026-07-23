import Link from "next/link";
import NavLink from "@/components/NavLink";
import SampleBanner from "@/components/SampleBanner";
import { signOutAction } from "../(auth)/login/actions";
export const dynamic = "force-dynamic";
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4 sm:gap-8">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-nhs-blue">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-nhs-blue text-sm text-white">Q</span>
              QOF Optimiser
            </Link>
            <nav className="flex gap-4 text-sm sm:gap-6">
              <NavLink href="/dashboard">Dashboard</NavLink>
              <NavLink href="/domains">Domains</NavLink>
              <NavLink href="/indicators">Indicators</NavLink>
              <NavLink href="/map">Map</NavLink>
              <NavLink href="/account">My account</NavLink>
            </nav>
          </div>
          <form action={signOutAction}><button className="text-sm text-slate-500 hover:text-nhs-red">Sign out</button></form>
        </div>
      </header>
      <SampleBanner />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
    </div>
  );
}
