import { createClient } from "@/lib/supabase/server";
import { CURRENT_YEAR } from "@/lib/qof/data";
import { pointsEarned, gbp, IndicatorYear } from "@/lib/qof/calc";
import { filterInterventions, Intervention } from "@/lib/ai/interventions";

// §1.2 — the application assembles every input and PRE-COMPUTES every number.
// The model must not do arithmetic; it only selects, contextualises and copies
// the figures produced here.

export type PriorityIndicator = {
  indicator_code: string;
  indicator_name: string;
  domain: string;
  domain_label: string;
  current_pct: number | null;
  icb_median_pct: number | null;
  national_median_pct: number | null;
  points_available: number;
  points_achieved: number | null;
  exception_rate_pct: number | null;
  icb_exception_rate_pct: number | null;
  exception_outlier: boolean; // exception rate materially above ICB — likely coding, not clinical
  points_recoverable: number; // to ICB median
  est_patients_range: string; // pre-formatted; model copies verbatim
  est_value_range: string; // pre-formatted; model copies verbatim
};

export type DomainPrevalence = {
  group_code: string;
  domain_label: string;
  practice_prevalence_pct: number | null;
  national_prevalence_pct: number | null;
  materially_below_expected: boolean;
};

export type QiPlanInput = {
  practice: {
    name: string;
    ods_code: string;
    list_size: number | null;
    pcn: string | null;
    icb: string | null;
    imd_decile: number | null;
    cpi: number; // contractor population index
  };
  qof_year: string;
  priority_indicators: PriorityIndicator[]; // sorted by points recoverable, desc
  at_or_near_max: { indicator_code: string; indicator_name: string; current_pct: number | null }[];
  domain_prevalence: DomainPrevalence[];
  interventions: Intervention[]; // filtered library the model may select from
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function patientsRange(n: number): string {
  if (n <= 0) return "0";
  const lo = Math.max(0, Math.round((n * 0.9) / 5) * 5);
  let hi = Math.round((n * 1.1) / 5) * 5;
  if (hi <= lo) hi = lo + 5;
  return `${lo}–${hi}`; // en dash
}

function valueRange(v: number): string {
  if (v <= 0) return "£0";
  const lo = Math.max(0, Math.round((v * 0.85) / 100) * 100);
  let hi = Math.round((v * 1.15) / 100) * 100;
  if (hi <= lo) hi = lo + 100;
  return `${gbp(lo)}–${gbp(hi).replace("£", "")}`;
}

export async function assembleQiPlanInput(practiceCode: string): Promise<QiPlanInput> {
  const supabase = await createClient();
  const year = CURRENT_YEAR;

  const [{ data: inds }, { data: years }, { data: pracAch }, { data: org }, { data: meta }, { data: pracPrev }, { data: natPrev }] =
    await Promise.all([
      supabase.from("qof_indicator").select("*"),
      supabase.from("qof_indicator_year").select("*").eq("year", year),
      supabase.from("qof_achievement").select("*").eq("year", year).eq("ods_code", practiceCode),
      supabase.from("organisation").select("name,list_size,parent_pcn,parent_icb,imd_decile").eq("ods_code", practiceCode).single(),
      supabase.from("qof_meta").select("*").eq("year", year).maybeSingle(),
      supabase.from("prevalence").select("group_code,register,list_size").eq("ods_code", practiceCode),
      supabase.from("prevalence").select("group_code,register,list_size").eq("ods_code", "ENG"),
    ]);

  const icbCode = (org as any)?.parent_icb ?? null;
  const [{ data: icbAch }, { data: natAch }] = await Promise.all([
    icbCode
      ? supabase.from("qof_achievement").select("*").eq("year", year).eq("ods_code", icbCode)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("qof_achievement").select("*").eq("year", year).eq("ods_code", "ENG"),
  ]);

  const yearMap = new Map((years ?? []).map((y: any) => [y.indicator_code, y]));
  const pracMap = new Map((pracAch ?? []).map((a: any) => [a.indicator_code, a]));
  const icbMap = new Map((icbAch ?? []).map((a: any) => [a.indicator_code, a]));
  const natMap = new Map((natAch ?? []).map((a: any) => [a.indicator_code, a]));
  const pPrev = new Map((pracPrev ?? []).map((p: any) => [p.group_code, p.list_size > 0 ? (p.register / p.list_size) * 100 : null]));
  const nPrev = new Map((natPrev ?? []).map((p: any) => [p.group_code, p.list_size > 0 ? (p.register / p.list_size) * 100 : null]));

  const nationalAvg = (meta as any)?.national_avg_list_size ?? null;
  const listSize = (org as any)?.list_size ?? null;
  const cpi = listSize && nationalAvg ? round1(listSize / nationalAvg) : 1;

  function exceptionRate(a: any): number | null {
    if (!a) return null;
    const denom = a.denominator ?? null;
    const exc = a.pca_exceptions ?? null;
    if (exc == null || denom == null || denom + exc <= 0) return null;
    return round1((exc / (denom + exc)) * 100);
  }

  const priority: PriorityIndicator[] = [];
  const nearMax: QiPlanInput["at_or_near_max"] = [];

  for (const i of inds ?? []) {
    const y: any = yearMap.get(i.indicator_code);
    if (!y) continue;
    const a: any = pracMap.get(i.indicator_code);
    // Skip indicators the practice has no achievement data for (e.g. stale
    // sample-seed indicators not in the real publication) — they aren't a gap.
    if (!a) continue;
    const icb: any = icbMap.get(i.indicator_code);
    const nat: any = natMap.get(i.indicator_code);

    const currentPct = a?.achievement_pct ?? null;
    const icbPct = icb?.achievement_pct ?? null;
    const natPct = nat?.achievement_pct ?? null;
    const pointsAvail = y.points ?? 0;
    const pointsAchieved = a?.points_achieved ?? null;

    // At or near max? "No action needed" is useful output (§1.3).
    if (pointsAchieved != null && pointsAvail > 0 && pointsAchieved / pointsAvail >= 0.95) {
      nearMax.push({ indicator_code: i.indicator_code, indicator_name: i.title, current_pct: currentPct });
      continue;
    }
    if (pointsAchieved == null && currentPct != null && y.upper_threshold != null && currentPct >= y.upper_threshold) {
      nearMax.push({ indicator_code: i.indicator_code, indicator_name: i.title, current_pct: currentPct });
      continue;
    }

    // Points recoverable to ICB median.
    let pointsRecoverable = 0;
    const iy: IndicatorYear = {
      points: pointsAvail,
      lower_threshold: y.lower_threshold ?? null,
      upper_threshold: y.upper_threshold ?? null,
      pound_per_point: y.pound_per_point ?? 0,
    };
    if (currentPct != null && icbPct != null && icbPct > currentPct) {
      if (y.lower_threshold != null && y.upper_threshold != null) {
        pointsRecoverable = round1(Math.max(0, pointsEarned(icbPct, iy) - pointsEarned(currentPct, iy)));
      } else {
        pointsRecoverable = round1(Math.max(0, ((icbPct - currentPct) / 100) * pointsAvail));
      }
    }

    // Estimated patients to close the gap to ICB median.
    const denom = a?.denominator ?? null;
    let estPatients = 0;
    if (denom != null && currentPct != null && icbPct != null && icbPct > currentPct) {
      estPatients = Math.max(0, (denom * (icbPct - currentPct)) / 100);
    }

    // Estimated £ value of the recoverable points (weighted, QOF way).
    let apdf = 1;
    if (i.domain !== "public_health" && i.group_code) {
      const pp = pPrev.get(i.group_code);
      const np = nPrev.get(i.group_code);
      if (pp != null && np && np > 0) apdf = round1(pp / np);
    }
    const value = pointsRecoverable * (y.pound_per_point ?? 0) * cpi * apdf;

    const excPrac = exceptionRate(a);
    const excIcb = exceptionRate(icb);
    const exceptionOutlier = excPrac != null && excIcb != null && excPrac >= excIcb + 10;

    priority.push({
      indicator_code: i.indicator_code,
      indicator_name: i.title,
      domain: i.domain,
      domain_label: i.domain_label,
      current_pct: currentPct,
      icb_median_pct: icbPct,
      national_median_pct: natPct,
      points_available: pointsAvail,
      points_achieved: pointsAchieved,
      exception_rate_pct: excPrac,
      icb_exception_rate_pct: excIcb,
      exception_outlier: exceptionOutlier,
      points_recoverable: pointsRecoverable,
      est_patients_range: patientsRange(estPatients),
      est_value_range: valueRange(value),
    });
  }

  // Sort by points recoverable, NOT by size of percentage gap (§1.3).
  priority.sort((a, b) => b.points_recoverable - a.points_recoverable);

  // Prevalence per domain vs national, flagged where materially below expected.
  const domainByGroup = new Map<string, string>();
  for (const i of inds ?? []) if (i.group_code) domainByGroup.set(i.group_code, i.domain_label);
  const domainPrev: DomainPrevalence[] = [];
  for (const [group, label] of domainByGroup) {
    const pp = pPrev.get(group) ?? null;
    const np = nPrev.get(group) ?? null;
    domainPrev.push({
      group_code: group,
      domain_label: label,
      practice_prevalence_pct: pp != null ? round1(pp) : null,
      national_prevalence_pct: np != null ? round1(np) : null,
      materially_below_expected: pp != null && np != null && np > 0 && pp / np < 0.8,
    });
  }

  const gapCodes = priority.map((p) => p.indicator_code);

  return {
    practice: {
      name: (org as any)?.name ?? practiceCode,
      ods_code: practiceCode,
      list_size: listSize,
      pcn: (org as any)?.parent_pcn ?? null,
      icb: icbCode,
      imd_decile: (org as any)?.imd_decile ?? null,
      cpi,
    },
    qof_year: year,
    priority_indicators: priority,
    at_or_near_max: nearMax,
    domain_prevalence: domainPrev,
    interventions: filterInterventions(gapCodes),
  };
}
