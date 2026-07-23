import Link from "next/link";
import { getUserPractice } from "@/lib/qof/data";
import { getPrescribing, type RxRow } from "@/lib/qof/prescribing";
export const dynamic = "force-dynamic";

function fmt(v: number | null, unit: string): string {
  if (v == null) return "—";
  return unit === "%" ? `${v}%` : `${v}`;
}

// Percentile → colour (all measures here are "higher is better").
function pctColour(p: number | null): string {
  if (p == null) return "#94a3b8";
  if (p >= 80) return "#007F3B";
  if (p >= 60) return "#78BE20";
  if (p >= 40) return "#FFB81C";
  if (p >= 20) return "#f97316";
  return "#DA291C";
}

export default async function PrescribingPage() {
  const { practiceCode } = await getUserPractice();
  const { rows, period } = await getPrescribing(practiceCode!);
  const hasData = rows.some((r) => r.you != null);

  const byDomain = new Map<string, RxRow[]>();
  for (const r of rows) {
    (byDomain.get(r.domain_label) ?? byDomain.set(r.domain_label, []).get(r.domain_label)!).push(r);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Prescribing</h1>
        <p className="mt-1 text-slate-600">
          Primary-care prescribing volumes from OpenPrescribing, as mean monthly items per 1,000 patients, benchmarked
          against your ICB and England. These are prescribing signals that support your QOF clinical indicators.
        </p>
        {period && <p className="mt-1 text-xs text-slate-400">OpenPrescribing, {period}.</p>}
      </div>

      {!hasData ? (
        <div className="card">
          <h2 className="font-semibold">No prescribing data loaded yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            Run the ingest on your machine to populate this page:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">node scripts/ingest-openprescribing.mjs</pre>
          <p className="mt-2 text-xs text-slate-500">It pulls from openprescribing.net and rolls up to PCN / ICB / England automatically.</p>
        </div>
      ) : (
        [...byDomain.entries()].map(([domain, metrics]) => (
          <section key={domain}>
            <h2 className="mb-3 text-lg font-semibold">{domain}</h2>
            <div className="grid gap-3">
              {metrics.map((r) => (
                <MetricCard key={r.metric_key} r={r} />
              ))}
            </div>
          </section>
        ))
      )}

      <p className="text-xs text-slate-400">
        Descriptive prescribing comparisons based on published OpenPrescribing data — not a judgement of any clinician,
        and not case-mix adjusted. Read alongside your registered prevalence. Not clinical advice.
      </p>
    </div>
  );
}

function MetricCard({ r }: { r: RxRow }) {
  const belowBench = r.you != null && r.england != null && r.you < r.england;
  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">{r.short}</h3>
          <p className="text-sm text-slate-500">{r.name}</p>
          {r.qof_link && <p className="mt-1 text-xs text-nhs-blue">{r.qof_link}</p>}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-900">{fmt(r.you, r.unit)}</div>
          <div className="text-xs text-slate-400">{r.unit === "%" ? "of statins" : "items / 1,000 patients"}</div>
        </div>
      </div>

      {/* percentile bar */}
      {r.you_pct != null && (
        <div className="mt-4">
          <div className="relative h-2 w-full rounded-full bg-slate-100">
            <div className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full"
              style={{ left: `calc(${r.you_pct}% - 2px)`, background: pctColour(r.you_pct) }} />
          </div>
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>Lowest in England</span>
            <span className="font-medium" style={{ color: pctColour(r.you_pct) }}>{r.you_pct}th percentile</span>
            <span>Highest</span>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-100 pt-3 text-sm">
        <span className="text-slate-500">ICB: <span className="font-medium text-slate-700">{fmt(r.icb, r.unit)}</span></span>
        <span className="text-slate-500">England: <span className="font-medium text-slate-700">{fmt(r.england, r.unit)}</span></span>
        {belowBench && <span className="font-medium text-amber-600">Below the England average</span>}
      </div>
    </div>
  );
}
