import { createClient } from "@/lib/supabase/server";
import { moneyAtRisk, pointsShortfall, ragFromPoints, rag, Rag } from "./calc";

export const CURRENT_YEAR = process.env.NEXT_PUBLIC_QOF_YEAR || "2025/26";

// Supabase caps a single select at ~1000 rows. This pages through a query
// builder to return every matching row. Pass a factory so each page is a fresh
// builder; it must apply a stable .order() for correct paging.
export async function fetchAllRows<T = any>(makeQuery: (from: number, to: number) => any, pageSize = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < pageSize) break;
  }
  return out;
}

export async function getUserPractice() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, practiceCode: null as string | null };
  const { data: profile } = await supabase.from("profile").select("practice_ods_code").eq("user_id", user.id).single();
  return { user, practiceCode: profile?.practice_ods_code ?? "A81001" };
}

export type PracticeContext = { practiceCode: string; pcn: string | null; icb: string | null; imdQuintile: number | null };
export async function getPracticeContext(): Promise<PracticeContext> {
  const supabase = await createClient();
  const { practiceCode } = await getUserPractice();
  const code = practiceCode ?? "A81001";
  const { data: org } = await supabase.from("organisation").select("parent_pcn,parent_icb,imd_quintile").eq("ods_code", code).single();
  return { practiceCode: code, pcn: org?.parent_pcn ?? null, icb: org?.parent_icb ?? null, imdQuintile: org?.imd_quintile ?? null };
}

export type IndicatorRow = {
  indicator_code: string; domain: string; domain_label: string; title: string; description: string | null; group_code: string | null;
  achievement_pct: number | null; points: number; points_achieved: number | null;
  lower_threshold: number | null; upper_threshold: number | null; pound_per_point: number; status: string;
  cpi: number; apdf: number; money_unweighted: number; money_at_risk: number; points_short: number; rag: Rag;
  is_register: boolean;
};

// list-size + prevalence weighting per QOF guidance:
// payment = points x point_value x CPI x APDF (APDF clinical only)
export async function getIndicatorRows(practiceCode: string): Promise<IndicatorRow[]> {
  const supabase = await createClient();
  const [{ data: inds }, { data: years }, { data: ach }, { data: org }, { data: meta }, { data: prac }, { data: nat }] = await Promise.all([
    supabase.from("qof_indicator").select("*"),
    supabase.from("qof_indicator_year").select("*").eq("year", CURRENT_YEAR),
    supabase.from("qof_achievement").select("*").eq("year", CURRENT_YEAR).eq("ods_code", practiceCode),
    supabase.from("organisation").select("list_size").eq("ods_code", practiceCode).single(),
    supabase.from("qof_meta").select("*").eq("year", CURRENT_YEAR).single(),
    supabase.from("prevalence").select("group_code,register,list_size").eq("ods_code", practiceCode),
    supabase.from("prevalence").select("group_code,register,list_size").eq("ods_code", "ENG"),
  ]);

  const yearMap = new Map((years ?? []).map((y: any) => [y.indicator_code, y]));
  const achMap = new Map((ach ?? []).map((a: any) => [a.indicator_code, a]));
  const pPrev = new Map((prac ?? []).map((p: any) => [p.group_code, p.list_size > 0 ? p.register / p.list_size : null]));
  const nPrev = new Map((nat ?? []).map((p: any) => [p.group_code, p.list_size > 0 ? p.register / p.list_size : null]));
  const cpi = (org?.list_size && meta?.national_avg_list_size) ? org.list_size / meta.national_avg_list_size : 1;

  const rows: IndicatorRow[] = [];
  for (const i of inds ?? []) {
    const y: any = yearMap.get(i.indicator_code);
    if (!y) continue;
    const a: any = achMap.get(i.indicator_code);
    // No achievement row = practice has no data for this indicator (e.g. a
    // stale sample-seed indicator). Skip rather than show a phantom £0 row.
    if (!a) continue;
    // Compute the percentage from numerator/denominator when the publication
    // left it blank (a few rows arrive that way, e.g. COPD014 52/56).
    let pct = a.achievement_pct ?? null;
    if (pct == null && a.numerator != null && a.denominator > 0) {
      pct = Math.round((a.numerator / a.denominator) * 1000) / 10;
    }
    const achieved = a.points_achieved ?? null;
    // Register/points-only indicators carry no percentage at all — flag them so
    // the UI shows "Register" instead of a misleading "—%".
    const isRegister = pct == null && a.numerator == null && achieved != null;

    // APDF (clinical indicators only)
    let apdf = 1;
    if (i.domain !== "public_health" && i.group_code) {
      const pp = pPrev.get(i.group_code), np = nPrev.get(i.group_code);
      if (pp != null && np && np > 0) apdf = Math.round((pp / np) * 100) / 100;
    }

    let base: number, money: number, short: number, ragv: Rag;
    if (achieved != null) {
      short = Math.round((y.points - achieved) * 10) / 10;
      base = Math.round(Math.max(0, y.points - achieved) * y.pound_per_point);
      money = Math.round(base * cpi * apdf);
      ragv = ragFromPoints(y.points, achieved);
    } else if (pct != null && y.lower_threshold != null) {
      const iy = { points: y.points, lower_threshold: y.lower_threshold, upper_threshold: y.upper_threshold, pound_per_point: y.pound_per_point };
      base = moneyAtRisk(pct, iy); money = Math.round(base * cpi * apdf); short = pointsShortfall(pct, iy); ragv = rag(pct, y.lower_threshold, y.upper_threshold);
    } else { base = 0; money = 0; short = 0; ragv = "none"; }

    rows.push({
      indicator_code: i.indicator_code, domain: i.domain, domain_label: i.domain_label, title: i.title, description: i.description ?? null, group_code: i.group_code ?? null,
      achievement_pct: pct, points: y.points, points_achieved: achieved,
      lower_threshold: y.lower_threshold, upper_threshold: y.upper_threshold, pound_per_point: y.pound_per_point,
      status: y.status, cpi: Math.round(cpi * 100) / 100, apdf, money_unweighted: base, money_at_risk: money, points_short: short, rag: ragv,
      is_register: isRegister,
    });
  }
  return rows;
}

export async function getComparator(ctx: PracticeContext, compare: string): Promise<Map<string, number>> {
  const supabase = await createClient();
  if (compare === "similar") {
    if (ctx.imdQuintile == null) return new Map();
    const { data } = await supabase.rpc("similar_achievement", { p_quintile: ctx.imdQuintile, p_year: CURRENT_YEAR });
    return new Map((data ?? []).map((a: any) => [a.indicator_code, Number(a.achievement_pct)]));
  }
  const code = compare === "pcn" ? ctx.pcn : compare === "icb" ? ctx.icb : compare === "england" ? "ENG" : null;
  if (!code) return new Map();
  const { data } = await supabase.from("qof_achievement").select("indicator_code,achievement_pct").eq("year", CURRENT_YEAR).eq("ods_code", code);
  return new Map((data ?? []).map((a: any) => [a.indicator_code, Number(a.achievement_pct)]));
}

export type PracticeProfile = {
  name: string; list_size: number | null; cpi: number | null;
  imd_decile: number | null; imd_quintile: number | null; pct_rural: number | null; pct_female: number | null; pct_over_65: number | null;
  ethnicity: { category: string; pct: number }[];
};
export async function getPracticeProfile(practiceCode: string): Promise<PracticeProfile | null> {
  const supabase = await createClient();
  const [{ data: org }, { data: meta }, { data: eth }] = await Promise.all([
    supabase.from("organisation").select("name,list_size,imd_decile,imd_quintile,pct_rural,pct_female,pct_over_65").eq("ods_code", practiceCode).single(),
    supabase.from("qof_meta").select("national_avg_list_size").eq("year", CURRENT_YEAR).single(),
    supabase.from("practice_ethnicity").select("category,pct").eq("ods_code", practiceCode).order("pct", { ascending: false }),
  ]);
  if (!org) return null;
  const cpi = org.list_size && meta?.national_avg_list_size ? Math.round((org.list_size / meta.national_avg_list_size) * 100) / 100 : null;
  return { name: org.name, list_size: org.list_size, cpi, imd_decile: org.imd_decile, imd_quintile: org.imd_quintile, pct_rural: org.pct_rural, pct_female: org.pct_female, pct_over_65: org.pct_over_65, ethnicity: (eth ?? []) as any };
}
