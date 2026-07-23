import Link from "next/link";
import NavLink from "@/components/NavLink";
import SampleBanner from "@/components/SampleBanner";
import { signOutAction } from "../(auth)/login/actions";
export const dynamic = "force-dynamic";
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header data-no-print className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4 sm:gap-8">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold tracking-tight text-nhs-blue">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-nhs-blue text-sm font-bold text-white shadow-sm">Q</span>
              QOF Optimiser
            </Link>
            <nav className="flex gap-4 text-sm sm:gap-6">
              <NavLink href="/dashboard">Dashboard</NavLink>
              <NavLink href="/domains">Domains</NavLink>
              <NavLink href="/indicators">Indicators</NavLink>
              <NavLink href="/prescribing">Prescribing</NavLink>
              <NavLink href="/map">Map</NavLink>
              <NavLink href="/account">My account</NavLink>
            </nav>
          </div>
          <form action={signOutAction}><button className="text-sm text-slate-500 hover:text-nhs-red">Sign out</button></form>
        </div>
      </header>
      <div data-no-print><SampleBanner /></div>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      <footer data-no-print className="mt-8 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs leading-relaxed text-slate-500 sm:px-6">
          <p className="font-medium text-slate-600">QOF Optimiser</p>
          <p className="mt-1">
            Uses published NHS data only (QOF achievement, OpenPrescribing, NHS ODS) — no patient-identifiable data.
            Estimates are indicative and intended as prompts for discussion, not clinical or financial advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
