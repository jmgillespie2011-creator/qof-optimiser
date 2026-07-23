import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getIndicatorRows, getPracticeContext, getComparator } from "@/lib/qof/data";
import { gbp, RAG_TEXT, RAG_BADGE } from "@/lib/qof/calc";
import PaymentBar from "@/components/PaymentBar";
import CompareToggle from "@/components/CompareToggle";
export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string,string> = {
  current: "bg-nhs-green/10 text-nhs-green", retired: "bg-slate-200 text-slate-600", upcoming: "bg-nhs-amber/20 text-amber-700",
};
const COMPARE_LABEL: Record<string,string> = { pcn: "PCN", icb: "ICB", england: "England", similar: "Similar deprivation" };

export default async function DomainPage({ params, searchParams }: { params: Promise<{ domain: string }>; searchParams: Promise<{ compare?: string }> }) {
  const { domain } = await params;
  const { compare } = await searchParams;
  const ctx = await getPracticeContext();
  const rows = (await getIndicatorRows(ctx.practiceCode)).filter((r) => r.domain === domain);
  if (rows.length === 0) notFound();
  const label = rows[0].domain_label;
  const risk = rows.reduce((s, r) => s + r.money_at_risk, 0);
  const comp = compare ? await getComparator(ctx, compare) : new Map();

  const supabase = await createClient();
  const codes = rows.map((r) => r.indicator_code);
  const { data: qis } = await supabase.from("qi_suggestion").select("*").in("indicator_code", codes).order("priority_weight", { ascending: false });
  const qiByInd = new Map<string, any[]>();
  for (const q of qis ?? []) { const a = qiByInd.get(q.indicator_code) ?? []; a.push(q); qiByInd.set(q.indicator_code, a); }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/domains" className="text-sm text-nhs-blue">← All domains</Link>
          <h1 className="text-2xl font-bold">{label}</h1>
        </div>
        <div className="rounded-xl bg-nhs-blue px-5 py-3 text-white">
          <div className="text-xs opacity-90">Value at risk</div>
          <div className="text-2xl font-bold">{gbp(risk)}</div>
        </div>
      </div>

      <CompareToggle />

      <div className="grid gap-5">
        {rows.map((r) => {
          const g = r.rag;
          const cval = comp.get(r.indicator_code);
          return (
            <div key={r.indicator_code} className="card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/domains/${r.domain}/${r.indicator_code}`} className="font-semibold text-nhs-blue">{r.indicator_code}</Link>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status] ?? ""}`}>{r.status}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RAG_BADGE[g]}`}>
                      {g === "green" ? "On target" : g === "red" ? "Below threshold" : g === "none" ? "No data" : "In payment band"}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600">{r.title}</div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${RAG_TEXT[g]}`}>{r.achievement_pct ?? "—"}%</div>
                  <div className="text-xs text-slate-500">target {r.upper_threshold}% · {r.points} pts</div>
                  {compare && cval != null && <div className="text-xs font-medium text-slate-400">{COMPARE_LABEL[compare]}: {cval}%</div>}
                </div>
              </div>

              <div className="mt-3"><PaymentBar pct={r.achievement_pct} lower={r.lower_threshold} upper={r.upper_threshold} /></div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-500">{r.points_short} pts short</span>
                <span className="font-semibold">{gbp(r.money_at_risk)} at risk</span>
              </div>

              {(qiByInd.get(r.indicator_code) ?? []).slice(0,3).length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="mb-2 text-xs font-medium uppercase text-slate-400">Improvement actions</div>
                  <ul className="space-y-1">
                    {(qiByInd.get(r.indicator_code) ?? []).slice(0,3).map((q) => (
                      <li key={q.id}><Link href={`/qi/${q.id}`} className="text-sm text-nhs-blue hover:underline">→ {q.title}</Link></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
