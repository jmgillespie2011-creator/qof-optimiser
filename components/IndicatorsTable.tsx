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
      <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {filtered.map(r => (
          <Link
            key={r.indicator_code}
            href={`/domains/${r.domain}/${r.indicator_code}`}
            className="flex flex-col gap-3 p-4 transition hover:bg-slate-50/70 sm:flex-row sm:items-center sm:gap-4"
          >
            {/* code + domain */}
            <div className="flex items-center gap-2 sm:w-40 sm:shrink-0">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: RAG_HEX[r.rag] ?? "#cbd5e1" }} />
              <div className="min-w-0">
                <div className="font-mono text-sm font-semibold text-nhs-blue">{r.indicator_code}</div>
                <div className="truncate text-xs text-slate-400">{r.domain_label}</div>
              </div>
            </div>

            {/* what it is — inline definition */}
            <p className="min-w-0 flex-1 text-sm leading-snug text-slate-600 line-clamp-2">{r.description || r.title}</p>

            {/* achievement */}
            <div className="sm:w-24 sm:shrink-0 sm:text-right">
              {r.is_register ? (
                <span className="text-sm text-slate-500">Register</span>
              ) : (
                <span className={`text-sm font-semibold tabular-nums ${RAG_TEXT[r.rag] ?? ""}`}>{r.achievement_pct ?? "—"}%</span>
              )}
              <div className="text-xs text-slate-400">{r.points} pts</div>
            </div>

            {/* money */}
            <div className="sm:w-24 sm:shrink-0 sm:text-right">
              <div className="font-semibold tabular-nums text-slate-900">£{r.money_at_risk.toLocaleString()}</div>
              <div className="text-xs text-slate-400">at risk</div>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && <div className="p-6 text-center text-sm text-slate-500">No indicators match your search.</div>}
      </div>
    </div>
  );
}
