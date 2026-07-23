"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
type Row = {
  indicator_code: string; domain: string; domain_label: string; title: string; description: string | null;
  achievement_pct: number | null; upper_threshold: number | null; points: number; money_at_risk: number; rag: string;
  is_register?: boolean;
};
const RAG_TEXT: Record<string,string> = { green: "text-nhs-green", lime: "text-lime-600", amber: "text-amber-600", red: "text-nhs-red", none: "text-slate-400" };
const RAG_HEX: Record<string,string> = { green: "#007F3B", lime: "#78BE20", amber: "#FFB81C", red: "#DA291C", none: "#cbd5e1" };
export default function IndicatorsTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState(""); const [domain, setDomain] = useState("all"); const [sort, setSort] = useState<"risk"|"code"|"pts">("risk");
  const domains = useMemo(() => Array.from(new Set(rows.map(r => r.domain_label))).sort(), [rows]);
  const filtered = useMemo(() => {
    let f = rows.filter(r =>
      (domain === "all" || r.domain_label === domain) &&
      (q === "" || (r.indicator_code + " " + r.title).toLowerCase().includes(q.toLowerCase())));
    f = [...f].sort((a,b) => sort==="risk" ? b.money_at_risk-a.money_at_risk : sort==="pts" ? b.points-a.points : a.indicator_code.localeCompare(b.indicator_code));
    return f;
  }, [rows, q, domain, sort]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input className="input sm:max-w-xs" placeholder="Search indicators…" value={q} onChange={e=>setQ(e.target.value)} />
        <select className="input sm:w-52" value={domain} onChange={e=>setDomain(e.target.value)}>
          <option value="all">All domains</option>
          {domains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="input sm:w-48" value={sort} onChange={e=>setSort(e.target.value as any)}>
          <option value="risk">Sort: £ at risk</option>
          <option value="pts">Sort: points</option>
          <option value="code">Sort: code</option>
        </select>
        <span className="ml-auto self-center text-sm text-slate-500">{filtered.length} indicators</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="p-3 font-medium">Code</th>
              <th className="p-3 font-medium">Indicator</th>
              <th className="p-3 font-medium">Domain</th>
              <th className="p-3 text-right font-medium">You</th>
              <th className="p-3 text-right font-medium">Target</th>
              <th className="p-3 text-right font-medium">Pts</th>
              <th className="p-3 text-right font-medium">£ at risk</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.indicator_code} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="p-3"><Link href={`/domains/${r.domain}/${r.indicator_code}`} className="font-mono font-medium text-nhs-blue" title={r.description ?? undefined}>{r.indicator_code}</Link></td>
                <td className="p-3 text-slate-600" title={r.description ?? undefined}>{r.title}</td>
                <td className="p-3 text-slate-600">{r.domain_label}</td>
                <td className="p-3 text-right">
                  {r.is_register ? (
                    <span className="text-slate-500">Register</span>
                  ) : (
                    <span className={`inline-flex items-center gap-1.5 font-semibold tabular-nums ${RAG_TEXT[r.rag] ?? ""}`}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: RAG_HEX[r.rag] ?? "#cbd5e1" }} />
                      {r.achievement_pct ?? "—"}%
                    </span>
                  )}
                </td>
                <td className="p-3 text-right tabular-nums text-slate-500">{r.upper_threshold != null ? `${r.upper_threshold}%` : "—"}</td>
                <td className="p-3 text-right tabular-nums">{r.points}</td>
                <td className="p-3 text-right font-semibold tabular-nums">£{r.money_at_risk.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
