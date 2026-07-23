import { PracticeProfile } from "@/lib/qof/data";
const IMD_LABEL = (q: number | null) => q == null ? "—" : ["Most deprived", "More deprived", "Average", "Less deprived", "Least deprived"][q - 1] ?? String(q);
const ETH_COLOR: Record<string,string> = { White: "#94a3b8", Asian: "#005EB8", Black: "#003087", Mixed: "#41B6E6", Other: "#768692" };
export default function PracticeProfileCard({ p }: { p: PracticeProfile }) {
  return (
    <div className="card">
      <h2 className="font-semibold">{p.name}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Item label="List size" value={p.list_size?.toLocaleString() ?? "—"} />
        <Item label="Payment index (CPI)" value={p.cpi != null ? `×${p.cpi}` : "—"} />
        <Item label="Deprivation" value={p.imd_quintile != null ? `Q${p.imd_quintile} · ${IMD_LABEL(p.imd_quintile)}` : "—"} />
        <Item label="Rural patients" value={p.pct_rural != null ? `${p.pct_rural}%` : "—"} />
        <Item label="Female" value={p.pct_female != null ? `${p.pct_female}%` : "—"} />
        <Item label="Aged 65+" value={p.pct_over_65 != null ? `${p.pct_over_65}%` : "—"} />
      </div>
      {p.ethnicity.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs font-medium uppercase text-slate-400">Ethnicity (neighbourhood)</div>
          <div className="flex h-3 w-full overflow-hidden rounded-full">
            {p.ethnicity.map((e) => <div key={e.category} title={`${e.category} ${e.pct}%`} style={{ width: `${e.pct}%`, background: ETH_COLOR[e.category] ?? "#cbd5e1" }} />)}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            {p.ethnicity.filter(e => e.pct >= 1).map((e) => <span key={e.category}>{e.category} {e.pct}%</span>)}
          </div>
        </div>
      )}
    </div>
  );
}
function Item({ label, value }: { label: string; value: string }) {
  return <div><div className="text-slate-500">{label}</div><div className="mt-0.5 font-semibold">{value}</div></div>;
}
