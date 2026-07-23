import { createClient } from "@/lib/supabase/server";
import { getPracticeContext } from "./data";

export type RxMetric = {
  metric_key: string; domain: string; domain_label: string;
  name: string; short: string; unit: string; higher_is_better: boolean; qof_link: string | null; sort: number;
};

export type RxRow = RxMetric & {
  period: string | null;
  you: number | null; you_pct: number | null;   // practice crude rate + percentile
  you_adj: number | null; you_decile: number | null; // case-mix adjusted rate + 1-10 decile
  icb: number | null; england: number | null;
};

// Assemble a practice's prescribing measures alongside ICB and England benchmarks.
export async function getPrescribing(practiceCode: string): Promise<{ rows: RxRow[]; period: string | null }> {
  const supabase = await createClient();
  const ctx = await getPracticeContext();
  const icbCode = ctx.icb;

  const [{ data: metrics }, { data: mine }, { data: icb }, { data: eng }] = await Promise.all([
    supabase.from("rx_metric").select("*").order("sort"),
    supabase.from("rx_value").select("metric_key,items_per_1000,percentile,adj,decile,period").eq("ods_code", practiceCode),
    icbCode
      ? supabase.from("rx_value").select("metric_key,items_per_1000").eq("ods_code", icbCode).eq("org_level", "icb")
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("rx_value").select("metric_key,items_per_1000").eq("ods_code", "ENG").eq("org_level", "national"),
  ]);

  const mineMap = new Map((mine ?? []).map((r: any) => [r.metric_key, r]));
  const icbMap = new Map((icb ?? []).map((r: any) => [r.metric_key, r.items_per_1000]));
  const engMap = new Map((eng ?? []).map((r: any) => [r.metric_key, r.items_per_1000]));

  let period: string | null = null;
  const rows: RxRow[] = (metrics ?? []).map((m: any) => {
    const you: any = mineMap.get(m.metric_key);
    if (you?.period) period = you.period;
    return {
      ...m,
      period: you?.period ?? null,
      you: you?.items_per_1000 ?? null,
      you_pct: you?.percentile ?? null,
      you_adj: you?.adj ?? null,
      you_decile: you?.decile ?? null,
      icb: icbMap.get(m.metric_key) ?? null,
      england: engMap.get(m.metric_key) ?? null,
    };
  });
  return { rows, period };
}
