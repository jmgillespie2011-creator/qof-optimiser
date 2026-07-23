import Link from "next/link";
import { getUserPractice, getIndicatorRows } from "@/lib/qof/data";
import { gbp } from "@/lib/qof/calc";
export const dynamic = "force-dynamic";

const GROUPS: { title: string; domains: string[] }[] = [
  { title: "Clinical domain", domains: ["cvd", "diabetes", "respiratory", "mental_health", "other_clinical"] },
  { title: "Public health domain", domains: ["public_health"] },
];

export default async function DomainsIndex() {
  const { practiceCode } = await getUserPractice();
  const rows = await getIndicatorRows(practiceCode!);
  const domains = new Map<string, { label: string; count: number; risk: number }>();
  for (const r of rows) {
    const cur = domains.get(r.domain) ?? { label: r.domain_label, count: 0, risk: 0 };
    cur.count++; cur.risk += r.money_at_risk; domains.set(r.domain, cur);
  }
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">QOF domains</h1>
        <Link href="/indicators" className="btn-ghost text-sm">All indicators →</Link>
      </div>
      {GROUPS.map((grp) => {
        const items = grp.domains.filter((d) => domains.has(d));
        if (items.length === 0) return null;
        return (
          <section key={grp.title}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">{grp.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((d) => {
                const v = domains.get(d)!;
                return (
                  <Link key={d} href={`/domains/${d}`} className="card hover:border-nhs-blue">
                    <div className="font-semibold">{v.label}</div>
                    <div className="mt-1 text-sm text-slate-500">{v.count} indicator{v.count === 1 ? "" : "s"}</div>
                    <div className="mt-2 text-xl font-bold">{gbp(v.risk)}</div>
                    <div className="text-xs text-slate-500">at risk</div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
