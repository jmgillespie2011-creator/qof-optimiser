"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
const OPTS = [["", "None"], ["pcn", "PCN"], ["icb", "ICB"], ["england", "England"], ["similar", "Similar (IMD)"]];
export default function CompareToggle() {
  const router = useRouter(); const path = usePathname(); const sp = useSearchParams();
  const active = sp.get("compare") ?? "";
  return (
    <div className="flex items-center gap-1 text-sm">
      <span className="mr-1 text-slate-500">Compare vs:</span>
      {OPTS.map(([v, label]) => (
        <button key={v} onClick={() => router.push(`${path}${v ? `?compare=${v}` : ""}`)}
          className={`rounded-lg px-2.5 py-1 ${active === v ? "bg-nhs-blue text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-100"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
