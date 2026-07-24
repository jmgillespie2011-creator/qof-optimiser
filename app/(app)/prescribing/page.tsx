import Link from "next/link";
import { getUserPractice } from "@/lib/qof/data";
import { getPrescribing, type RxRow } from "@/lib/qof/prescribing";
export const dynamic = "force-dynamic";
export const metadata = { title: "Prescribing" };

function fmt(v: number | null, unit: string): string {
  if (v == null) return "—";
  return unit === "%" ? `${v}%` : `${v}`;
}

// Sublabel for share (%) measures — the denominator group.
const SHARE_OF: Record<string, string> = {
  rx_statin_hi: "of all statins",
  rx_metformin_mr: "of all metformin",
  rx_doac_anticoag: "of oral anticoagulants",
  rx_saba_ics: "of reliever + preventer",
  rx_env_inhalers: "of all inhalers",
};

// Per-indicator clinical rationale: why this prescribing rate matters for QOF.
const RATIONALE: Record<string, string> = {
  rx_sglt2i:
    "Higher SGLT2i use in the diabetes, CKD and heart-failure cohorts is associated with better HbA1c control and renal protection — supporting the DM and CKD indicators and reducing HF admissions (NICE NG28/NG203/NG106).",
  rx_glp1_sema:
    "GLP-1 agonists (semaglutide) drive HbA1c and weight reduction in type 2 diabetes — associated with achieving the DM glycaemic-control (HbA1c) target indicators.",
  rx_tirzepatide:
    "Tirzepatide gives substantial HbA1c and weight reduction in type 2 diabetes — supports achievement of the DM HbA1c target indicators in patients not at goal.",
  rx_statin:
    "Statin therapy is the foundation of lipid lowering in CVD, CKD and diabetes — it underpins the cholesterol-control indicators CHOL002/003.",
  rx_statin_hi:
    "High-intensity statins get more patients to their LDL/non-HDL target than lower-intensity ones — a stronger quality signal than total statin volume for meeting CHOL002/003.",
  rx_ezetimibe:
    "Ezetimibe add-on helps patients not at cholesterol target on a statin alone reach target — directly supports CHOL002/003 achievement.",
  rx_inclisiran:
    "Inclisiran is an option for established CVD not at cholesterol target on other lipid therapy — supports CHOL002/003 in resistant cases.",
  rx_doac:
    "DOAC anticoagulation in AF patients with a CHA2DS2-VASc score of 2+ is exactly what AF008 measures — higher appropriate DOAC use directly meets the AF anticoagulation indicator.",
  rx_doac_anticoag:
    "The share of oral anticoagulation given as a DOAC rather than warfarin. DOACs are first-line for most AF patients (no INR monitoring, fewer interactions) — a higher share reflects modern, guideline-concordant anticoagulation (AF008).",
  rx_metformin_mr:
    "Modified-release metformin as a share of all metformin. Updated NICE NG28 (Feb 2026) recommends MR first-line — similar efficacy to standard-release with fewer GI side-effects and better adherence, supporting the diabetes indicators.",
  rx_saba_ics:
    "Reliever (SABA) inhalers as a dose-adjusted share of reliever + preventer prescribing. High reliever reliance is a red flag for poorly controlled asthma — the BTS/NICE/SIGN guidance targets over-reliance. Lower is better; identify patients on frequent SABA for asthma review.",
  rx_env_inhalers:
    "Metered-dose inhalers (MDIs) as a share of all inhalers. MDIs have a far higher carbon footprint than dry-powder inhalers; where clinically suitable, switching reduces emissions (an NHS net-zero priority). Lower is better.",
  rx_opioid_highdose:
    "High-dose opioid prescribing per 1,000 patients (OpenPrescribing's oral morphine-equivalence measure). A patient-safety signal — high-dose opioids carry dependence and harm risk with limited benefit in chronic non-cancer pain. Lower is better; review high-dose patients.",
};

// Percentile → colour (all measures here are "higher is better").
function pctColour(p: number | null): string {
  if (p == null) return "#94a3b8";
  if (p >= 80) return "#007F3B";
  if (p >= 60) return "#78BE20";
  if (p >= 40) return "#FFB81C";
  if (p >= 20) return "#f97316";
  return "#DA291C";
}

// Decile (1-10, 10 = best) → colour, matching the atlas red→green ramp.
function decColour(d: number | null): string {
  return pctColour(d == null ? null : d * 10 - 5);
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
            Import it from the CVD &amp; Diabetes atlas files (instant, no network):
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">node scripts/import-atlas-prescribing.mjs</pre>
          <p className="mt-2 text-xs text-slate-500">Uses the atlases' real, case-mix-adjusted figures and rolls up to PCN / ICB / England.</p>
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
  // Direction-aware: for "lower is better" measures (SABA reliance, MDI %,
  // high-dose opioids) being below England is good, not bad.
  const cmp = r.you != null && r.england != null
    ? (r.higher_is_better ? Math.sign(r.you - r.england) : Math.sign(r.england - r.you))
    : 0; // >0 better than England, <0 worse
  const dirWord = r.higher_is_better ? (r.you! < r.england! ? "below" : "above") : (r.you! > r.england! ? "above" : "below");
  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">{r.short}</h3>
          <p className="text-sm text-slate-500">{r.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-900">{fmt(r.you, r.unit)}</div>
            <div className="text-xs text-slate-400">{r.unit === "%" ? (SHARE_OF[r.metric_key] ?? "share") : "items / 1,000 patients"}</div>
          </div>
          {r.you_decile != null && (
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg text-white"
              style={{ background: decColour(r.you_decile) }} title="Quality decile vs peers (10 = best)">
              <span className="text-lg font-bold leading-none">{r.you_decile}</span>
              <span className="text-[9px] leading-none opacity-90">/10</span>
            </div>
          )}
        </div>
      </div>

      {/* Why it matters for QOF (per indicator) */}
      {RATIONALE[r.metric_key] && (
        <p className="mt-3 border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-600">
          <span className="font-medium text-slate-700">Why it matters: </span>{RATIONALE[r.metric_key]}
        </p>
      )}

      {/* Decile position vs other English practices (case-mix adjusted) */}
      {r.you_decile != null && (
        <div className="mt-4">
          <div className="mb-1 text-xs font-medium text-slate-600">
            You&apos;re in <span style={{ color: decColour(r.you_decile) }} className="font-semibold">decile {r.you_decile} of 10</span> vs all English practices
            <span className="font-normal text-slate-400"> (10 = best{r.you_adj != null ? `; case-mix adjusted ${r.you_adj}` : ""})</span>
          </div>
          <div className="relative h-2.5 w-full rounded-full bg-gradient-to-r from-red-300 via-amber-200 to-green-300">
            <div className="absolute top-1/2 h-4 w-1.5 -translate-y-1/2 rounded-full ring-2 ring-white"
              style={{ left: `calc(${r.you_decile * 10 - 5}% - 3px)`, background: decColour(r.you_decile) }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-slate-400">
            <span>Poorest vs peers</span>
            <span>Best vs peers</span>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-100 pt-3 text-sm">
        <span className="text-slate-500">ICB: <span className="font-medium text-slate-700">{fmt(r.icb, r.unit)}</span></span>
        <span className="text-slate-500">England: <span className="font-medium text-slate-700">{fmt(r.england, r.unit)}</span></span>
        {cmp < 0 && <span className="font-medium text-amber-600">{dirWord === "below" ? "Below" : "Above"} the England average</span>}
        {cmp > 0 && <span className="font-medium text-nhs-green">Better than the England average</span>}
      </div>
    </div>
  );
}
