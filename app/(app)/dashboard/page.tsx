import Link from "next/link";
import { getUserPractice, getIndicatorRows, getPracticeProfile, CURRENT_YEAR } from "@/lib/qof/data";
import { gbp, RAG_TEXT, RAG_HEX } from "@/lib/qof/calc";
import PaymentBar from "@/components/PaymentBar";
import PracticeProfileCard from "@/components/PracticeProfile";
export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const { practiceCode } = await getUserPractice();
  const rows = await getIndicatorRows(practiceCode!);
  const profile = await getPracticeProfile(practiceCode!);

  if (rows.length === 0) {
    return (
      <div className="card mx-auto max-w-lg text-center">
        <h1 className="text-xl font-bold">No QOF data yet</h1>
        <p className="mt-2 text-slate-600">We couldn&apos;t find indicator data for your practice. Import a QOF dataset, or explore the sample data to see how it works.</p>
        <Link href="/domains" className="btn mt-4">Explore domains</Link>
      </div>
    );
  }

  const total = rows.reduce((s, r) => s + r.money_at_risk, 0);
  const ppp = rows[0]?.pound_per_point ?? 225.49;
  const ranked = [...rows].sort((a, b) => b.money_at_risk - a.money_at_risk);
  const byDomain = new Map<string, { label: string; risk: number }>();
  for (const r of rows) {
    const cur = byDomain.get(r.domain) ?? { label: r.domain_label, risk: 0 };
    cur.risk += r.money_at_risk; byDomain.set(r.domain, cur);
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl bg-nhs-blue p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm opacity-90">Estimated QOF value at risk across all domains ({CURRENT_YEAR})</p>
            <p className="mt-1 text-3xl font-bold sm:text-4xl">{gbp(total)}</p>
            <p className="mt-1 text-sm opacity-90" title={`Sum across indicators of (points short) × ${gbp(ppp)}/point, weighted by list size and prevalence`}>
              Based on current achievement vs upper payment thresholds at {gbp(ppp)}/point.
            </p>
          </div>
          <Link href="/qi-plan" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-nhs-blue hover:bg-slate-100">
            Generate QI plan →
          </Link>
        </div>
      </div>

      {profile && <PracticeProfileCard p={profile} />}

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Biggest opportunities</h2>
          <span className="text-sm text-slate-400">{ranked.length} indicators, ranked by £ at risk</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="p-3 font-medium">Indicator</th>
                <th className="p-3 font-medium">Domain</th>
                <th className="w-56 p-3 font-medium">Payment band</th>
                <th className="p-3 text-right font-medium">You</th>
                <th className="p-3 text-right font-medium">Pts short</th>
                <th className="p-3 text-right font-medium">£ at risk</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => {
                const g = r.rag;
                return (
                  <tr key={r.indicator_code} className="border-t border-slate-100 align-middle hover:bg-slate-50/60">
                    <td className="p-3"><Link href={`/domains/${r.domain}/${r.indicator_code}`} className="font-mono font-medium text-nhs-blue" title={r.description ?? undefined}>{r.indicator_code}</Link><div className="text-slate-500">{r.title}</div></td>
                    <td className="p-3 text-slate-600">{r.domain_label}</td>
                    <td className="p-3"><PaymentBar pct={r.achievement_pct} lower={r.lower_threshold} upper={r.upper_threshold} /></td>
                    <td className="p-3 text-right">
                      {r.is_register ? (
                        <span className="text-slate-500" title="Register / points-only indicator — no achievement %">Register</span>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 font-semibold tabular-nums ${RAG_TEXT[g]}`}>
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: RAG_HEX[g] }} />
                          {r.achievement_pct ?? "—"}%
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right tabular-nums text-slate-600">{r.points_short}</td>
                    <td className="p-3 text-right font-semibold tabular-nums">{gbp(r.money_at_risk)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">By domain</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...byDomain.entries()].sort((a,b)=>b[1].risk-a[1].risk).map(([domain, d]) => (
            <Link key={domain} href={`/domains/${domain}`} className="card card-hover">
              <div className="text-sm text-slate-500">{d.label}</div>
              <div className="mt-1 text-2xl font-bold">{gbp(d.risk)}</div>
              <div className="mt-1 text-sm text-nhs-blue">View dashboard →</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
