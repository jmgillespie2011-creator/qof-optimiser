import Link from "next/link";
import { getUserPractice, getIndicatorRows, getPracticeProfile, CURRENT_YEAR, type IndicatorRow } from "@/lib/qof/data";
import { gbp, RAG_HEX } from "@/lib/qof/calc";
import PracticeProfileCard from "@/components/PracticeProfile";
export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const { practiceCode } = await getUserPractice();
  const rows = await getIndicatorRows(practiceCode!);
  const profile = await getPracticeProfile(practiceCode!);

  if (rows.length === 0) {
    return (
      <div className="card mx-auto max-w-lg text-center">
        <h1 className="text-xl font-bold">No QOF data yet</h1>
        <p className="mt-2 text-slate-600">We couldn&apos;t find indicator data for your practice. Import a QOF dataset, or explore the sample data to see how it works.</p>
        <Link href="/domains" className="btn mt-4">Explore domains</Link>
      </div>
    );
  }

  const total = rows.reduce((s, r) => s + r.money_at_risk, 0);
  const ppp = rows[0]?.pound_per_point ?? 225.49;
  const totalPointsShort = Math.round(rows.reduce((s, r) => s + r.points_short, 0));
  const belowTarget = rows.filter((r) => !r.is_register && r.money_at_risk > 0).length;

  const byDomain = new Map<string, { label: string; risk: number }>();
  for (const r of rows) {
    const cur = byDomain.get(r.domain) ?? { label: r.domain_label, risk: 0 };
    cur.risk += r.money_at_risk; byDomain.set(r.domain, cur);
  }
  const domainsWithRisk = [...byDomain.values()].filter((d) => d.risk > 0).length;

  const opps = rows.filter((r) => r.money_at_risk > 0).sort((a, b) => b.money_at_risk - a.money_at_risk);
  const topOpps = opps.slice(0, 12);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker">Practice dashboard</div>
          <h1 className="mt-1 text-2xl font-bold">{profile?.name ?? "Your practice"}</h1>
          <p className="text-sm text-slate-500">QOF {CURRENT_YEAR} · benchmarked across every domain</p>
        </div>
        <Link href="/qi-plan" className="btn">Generate QI plan →</Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-nhs-blue/30 bg-nhs-blue/5 p-4">
          <div className="text-xs text-slate-500">Total value at risk</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-nhs-blue">{gbp(total)}</div>
          <div className="text-xs text-slate-400">at {gbp(ppp)}/point, weighted</div>
        </div>
        <Kpi label="Points recoverable" value={totalPointsShort.toLocaleString()} />
        <Kpi label="Indicators below target" value={String(belowTarget)} />
        <Kpi label="Domains to focus" value={String(domainsWithRisk)} />
      </div>

      {profile && <PracticeProfileCard p={profile} />}

      {/* Biggest opportunities — self-explanatory rows, no hover needed */}
      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Biggest opportunities</h2>
          <Link href="/indicators" className="text-sm font-medium text-nhs-blue">View all {rows.length} indicators →</Link>
        </div>
        {topOpps.length === 0 ? (
          <div className="card text-slate-600">No indicators are below their payment threshold — you&apos;re at or near maximum across the board.</div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {topOpps.map((r) => <OppRow key={r.indicator_code} r={r} />)}
          </div>
        )}
      </section>

      {/* By domain */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">By domain</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...byDomain.entries()].sort((a, b) => b[1].risk - a[1].risk).map(([domain, d]) => (
            <Link key={domain} href={`/domains/${domain}`} className="card card-hover">
              <div className="text-sm text-slate-500">{d.label}</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">{gbp(d.risk)}</div>
              <div className="mt-1 text-sm text-nhs-blue">View domain →</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}

function OppRow({ r }: { r: IndicatorRow }) {
  const you = r.achievement_pct;
  const target = r.upper_threshold;
  const colour = RAG_HEX[r.rag];
  return (
    <Link
      href={`/domains/${r.domain}/${r.indicator_code}`}
      className="flex flex-col gap-3 p-4 transition hover:bg-slate-50/70 sm:flex-row sm:items-center sm:gap-4"
    >
      {/* code + domain */}
      <div className="flex items-center gap-2 sm:w-40 sm:shrink-0">
        <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colour }} />
        <div className="min-w-0">
          <div className="font-mono text-sm font-semibold text-nhs-blue">{r.indicator_code}</div>
          <div className="truncate text-xs text-slate-400">{r.domain_label}</div>
        </div>
      </div>

      {/* what it is — the actual definition, inline */}
      <p className="min-w-0 flex-1 text-sm leading-snug text-slate-600 line-clamp-2">
        {r.description || r.title}
      </p>

      {/* you vs target */}
      <div className="sm:w-44 sm:shrink-0">
        <div className="relative h-1.5 w-full rounded-full bg-slate-100">
          {you != null && <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, Math.max(0, you))}%`, background: colour }} />}
          {target != null && <div className="absolute -inset-y-1 w-0.5 bg-slate-400" style={{ left: `${Math.min(100, target)}%` }} title={`Target ${target}%`} />}
        </div>
        <div className="mt-1 text-xs tabular-nums text-slate-500">
          <span className="font-semibold" style={{ color: colour }}>{you != null ? `${you}%` : "—"}</span>
          {target != null && <span className="text-slate-400"> · target {target}%</span>}
        </div>
      </div>

      {/* money */}
      <div className="sm:w-24 sm:shrink-0 sm:text-right">
        <div className="font-semibold tabular-nums text-slate-900">{gbp(r.money_at_risk)}</div>
        <div className="text-xs text-slate-400">at risk</div>
      </div>
    </Link>
  );
}
