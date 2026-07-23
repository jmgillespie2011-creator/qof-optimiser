import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserPractice, getPracticeContext, getIndicatorRows, CURRENT_YEAR } from "@/lib/qof/data";
import { gbp, RAG_TEXT } from "@/lib/qof/calc";
import BenchmarkBars from "@/components/BenchmarkBars";
import TrendChart from "@/components/TrendChart";
import PaymentBar from "@/components/PaymentBar";
export const dynamic = "force-dynamic";

export default async function IndicatorPage({ params }: { params: Promise<{ domain: string; indicator: string }> }) {
  const { domain, indicator } = await params;
  const { practiceCode } = await getUserPractice();
  const supabase = await createClient();
  const code = indicator;
  const rows = await getIndicatorRows(practiceCode!);
  const row = rows.find((r) => r.indicator_code === code);

  // Only the four rows this benchmark needs — your practice, its PCN, its ICB,
  // and England. Without the ods_code filter the query returns every org in the
  // country and Supabase's 1000-row cap drops the PCN/ICB/national rows.
  const ctx = await getPracticeContext();
  const benchCodes = [practiceCode, ctx.pcn, ctx.icb, "ENG"].filter(Boolean) as string[];
  const { data: ind } = await supabase.from("qof_indicator").select("*").eq("indicator_code", code).single();
  const { data: iy } = await supabase.from("qof_indicator_year").select("*").eq("indicator_code", code).eq("year", CURRENT_YEAR).single();
  const { data: ach } = await supabase.from("qof_achievement").select("*").eq("indicator_code", code).eq("year", CURRENT_YEAR).in("ods_code", benchCodes);
  const { data: trend } = await supabase.from("qof_achievement").select("year,achievement_pct")
    .eq("indicator_code", code).eq("ods_code", practiceCode!).order("year", { ascending: true });

  const byLevel = new Map((ach ?? []).map((a: any) => [a.org_level, a]));
  const you: any = byLevel.get("practice");
  const bench = [
    { label: "You", value: Number(you?.achievement_pct ?? 0), you: true },
    { label: "PCN", value: Number((byLevel.get("pcn") as any)?.achievement_pct ?? 0) },
    { label: "ICB", value: Number((byLevel.get("icb") as any)?.achievement_pct ?? 0) },
    { label: "England", value: Number((byLevel.get("national") as any)?.achievement_pct ?? 0) },
  ];
  const g = row?.rag ?? "none";
  const trendData = (trend ?? []).map((t: any) => ({ year: t.year, value: Number(t.achievement_pct) }));
  const weighted = row && (row.cpi !== 1 || row.apdf !== 1);
  const { data: qis } = await supabase.from("qi_suggestion").select("*").eq("indicator_code", code).order("priority_weight", { ascending: false });

  return (
    <div className="space-y-6">
      <Link href={`/domains/${domain}`} className="text-sm text-nhs-blue">← {ind?.domain_label}</Link>
      <div>
        <h1 className="text-2xl font-bold">{code} · {ind?.title}</h1>
        <p className="mt-1 text-slate-600">{ind?.description}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Reported achievement" value={row?.is_register ? "Register" : `${you?.achievement_pct ?? "—"}%`} cls={RAG_TEXT[g]} />
        <Stat label="Whole-register achievement" value={row?.register_wide_pct != null ? `${row.register_wide_pct}%` : "—"} />
        <Stat label="Points" value={`${row?.points_achieved ?? "—"} / ${iy?.points ?? "—"}`} />
        <Stat label="£ at risk (weighted)" value={gbp(row?.money_at_risk ?? 0)} />
      </div>

      {row?.register_wide_pct != null && you?.achievement_pct != null && row.exceptions != null && (
        <div className="card border-amber-200 bg-amber-50/60">
          <h2 className="font-semibold">Reported rate vs the whole register</h2>
          <p className="mt-1 text-sm text-slate-700">
            The QOF <strong>reported</strong> rate of <strong>{you.achievement_pct}%</strong> excludes{" "}
            <strong>{row.exceptions.toLocaleString()}</strong> exception-coded patients (personalised care adjustments).
            Across the <strong>whole eligible register</strong> — including those patients — achievement is{" "}
            <strong>{row.register_wide_pct}%</strong>
            {you.achievement_pct - row.register_wide_pct >= 5 && (
              <>. That {(you.achievement_pct - row.register_wide_pct).toFixed(1)}-point gap means a sizeable cohort is
              exception-coded; a periodic review confirms the codes still apply and surfaces patients who could still be recalled</>
            )}
            . This is a clinical-quality view, not a QOF-payment one — payment is on the reported rate.
          </p>
        </div>
      )}

      {weighted && (
        <div className="card bg-slate-50">
          <h2 className="font-semibold">How this £ is calculated (QOF payment rules)</h2>
          <p className="mt-1 text-sm text-slate-700">
            (Max {iy?.points} − achieved {row?.points_achieved}) points × {gbp(iy?.pound_per_point ?? 0)}/point
            × <strong>CPI {row?.cpi}</strong> (list-size)
            {row?.apdf !== 1 && <> × <strong>APDF {row?.apdf}</strong> (prevalence)</>}
            {" = "}<strong>{gbp(row?.money_at_risk ?? 0)}</strong>.
            {" "}Unweighted this would be {gbp(row?.money_unweighted ?? 0)}.
          </p>
        </div>
      )}

      <div className="card">
        <h2 className="mb-3 font-semibold">Where you sit</h2>
        <PaymentBar pct={you ? Number(you.achievement_pct) : null} lower={iy?.lower_threshold ?? null} upper={iy?.upper_threshold ?? null} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">Benchmark: You vs PCN, ICB, England</h2>
          <BenchmarkBars data={bench} upper={iy?.upper_threshold} />
        </div>
        {trendData.length > 1 && (
          <div className="card">
            <h2 className="mb-3 font-semibold">Your trend</h2>
            <TrendChart data={trendData} upper={iy?.upper_threshold} />
          </div>
        )}
      </div>

      {qis && qis.length > 0 && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Up to 3 improvement actions</h2>
          <ul className="space-y-3">
            {qis.slice(0,3).map((q) => (
              <li key={q.id} className="rounded-lg border border-slate-200 p-4">
                <Link href={`/qi/${q.id}`} className="font-medium text-nhs-blue">{q.title}</Link>
                <p className="mt-1 text-sm text-slate-600">{q.rationale}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
function Stat({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return <div className="card"><div className="text-sm text-slate-500">{label}</div><div className={`mt-1 text-2xl font-bold ${cls ?? ""}`}>{value}</div></div>;
}
