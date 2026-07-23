import { createClient } from "@/lib/supabase/server";
import IndicatorSelect from "@/components/IndicatorSelect";
import MapClient from "@/components/MapClient";
import { CURRENT_YEAR } from "@/lib/qof/data";
import { getOrgHierarchy, getIndicatorAchievement } from "@/lib/qof/mapData";
export const dynamic = "force-dynamic";
export const metadata = { title: "Geographic view" };

export default async function MapPage({ searchParams }: { searchParams: Promise<{ indicator?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: inds } = await supabase.from("qof_indicator").select("indicator_code,title,domain_label").order("indicator_code");
  const indicator = sp.indicator || inds?.[0]?.indicator_code || "CHOL004";

  const { data: iy } = await supabase.from("qof_indicator_year").select("*").eq("indicator_code", indicator).eq("year", CURRENT_YEAR).single();

  // achievement for this indicator + the org hierarchy — cached (day-long), so
  // these ~15k rows aren't re-scanned on every map load.
  const [ach, orgs] = await Promise.all([
    getIndicatorAchievement(indicator, CURRENT_YEAR),
    getOrgHierarchy(),
  ]);
  const pctByOds = new Map((ach ?? []).map((a: any) => [a.ods_code, Number(a.achievement_pct)]));
  const icbValues: Record<string, number> = {};
  const pcnsByIcb: Record<string, any[]> = {};
  const practicesByPcn: Record<string, any[]> = {};
  for (const o of orgs ?? []) {
    if (o.org_level === "icb") {
      const pct = pctByOds.get(o.ods_code);
      if (pct != null) { icbValues[o.ods_code] = pct; if (o.ons_code) icbValues[o.ons_code] = pct; }
    } else if (o.org_level === "pcn" && o.parent_icb) {
      (pcnsByIcb[o.parent_icb] ??= []).push({ code: o.ods_code, name: o.name, pct: pctByOds.get(o.ods_code) ?? null, listSize: o.list_size });
    } else if (o.org_level === "practice" && o.parent_pcn) {
      (practicesByPcn[o.parent_pcn] ??= []).push({ code: o.ods_code, name: o.name, pct: pctByOds.get(o.ods_code) ?? null });
    }
  }
  const colouredCount = new Set(Object.keys(icbValues).filter(k => k.length <= 3)).size;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Geographic view</h1>
          <p className="text-sm text-slate-500">Click an ICB to zoom in and see its PCNs and practices.</p>
        </div>
        <IndicatorSelect options={(inds ?? []) as any} value={indicator} />
      </div>
      <p className="text-sm text-slate-600">
        ICB achievement for {indicator}. Green = at/above target ({iy?.upper_threshold}%), red = below lower threshold ({iy?.lower_threshold}%).
        {" "}{colouredCount} ICB(s) have data — run the ingestion to colour all 42.
      </p>
      <MapClient icbValues={icbValues} pcnsByIcb={pcnsByIcb} practicesByPcn={practicesByPcn}
        lower={Number(iy?.lower_threshold ?? 20)} upper={Number(iy?.upper_threshold ?? 50)} indicator={indicator} />
      <div className="flex flex-wrap gap-3 text-sm sm:gap-4">
        <Legend color="#007F3B" label="At/above target" />
        <Legend color="#78BE20" label="Approaching" />
        <Legend color="#FFB81C" label="In payment band" />
        <Legend color="#DA291C" label="Below lower threshold" />
        <Legend color="#e2e8f0" label="No data" />
      </div>
    </div>
  );
}
function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded" style={{ background: color }} /> {label}</span>;
}
