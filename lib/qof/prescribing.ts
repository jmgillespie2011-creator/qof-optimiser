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
      ? supabase.from("rx_value").select("metric_key,items_per_1000,period").eq("ods_code", icbCode).eq("org_level", "icb")
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("rx_value").select("metric_key,items_per_1000,period").eq("ods_code", "ENG").eq("org_level", "national"),
  ]);

  // Multiple datasets can be loaded (atlas + OpenPrescribing ingests) covering
  // different measures. Pick the freshest row PER measure rather than filtering
  // the whole page to one period — a fresh OpenPrescribing ingest supersedes the
  // atlas for the same measure, but complementary measures still show.
  const rank = (p?: string | null) => (p && p.includes("atlas") ? 0 : 1); // atlas is the fallback
  const bestByMetric = (rows: any[] | null) => {
    const m = new Map<string, any>();
    for (const r of rows ?? []) {
      const cur = m.get(r.metric_key);
      const better = !cur || rank(r.period) > rank(cur.period) ||
        (rank(r.period) === rank(cur.period) && (r.period ?? "") > (cur.period ?? ""));
      if (better) m.set(r.metric_key, r);
    }
    return m;
  };
  const mineMap = bestByMetric(mine);
  const icbBest = bestByMetric(icb);
  const engBest = bestByMetric(eng);
  const icbMap = new Map([...icbBest].map(([k, r]) => [k, r.items_per_1000]));
  const engMap = new Map([...engBest].map(([k, r]) => [k, r.items_per_1000]));
  const period = [...mineMap.values()].map((r) => r.period).find((p) => p && !p.includes("atlas")) ?? null;

  const rows: RxRow[] = (metrics ?? []).map((m: any) => {
    const you: any = mineMap.get(m.metric_key);
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
