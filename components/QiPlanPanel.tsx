"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { QiPlan, PriorityRow, PlanIntervention } from "@/lib/ai/qiPlan/types";
import { INTERVENTIONS } from "@/lib/ai/interventions";
import CopyBlock from "@/components/CopyBlock";

// Verified copy-ready patient messages, keyed by intervention id (so the plan
// shows the exact library text, never model-generated wording).
const ACCURX: Record<string, string> = Object.fromEntries(
  INTERVENTIONS.filter((i) => i.accurx_message).map((i) => [i.id, i.accurx_message as string]),
);

type Status = "idle" | "queued" | "running" | "done" | "error";

const GAP_STYLE: Record<string, { label: string; cls: string }> = {
  achievement: { label: "Achievement gap", cls: "bg-nhs-blue/10 text-nhs-blue" },
  exception_coding: { label: "Exception / coding", cls: "bg-amber-100 text-amber-700" },
  prevalence_coding: { label: "Prevalence / coding", cls: "bg-purple-100 text-purple-700" },
};

// Turn a machine domain key ("public_health") into a heading ("Public health").
function prettyDomain(d: string): string {
  const s = d.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Pull the low/high bounds out of a value/patient range string like "£800–1,100".
function parseRange(s: string): [number, number] | null {
  const nums = (s.match(/[\d,]+(?:\.\d+)?/g) ?? []).map((n) => Number(n.replace(/,/g, "")));
  if (nums.length === 0) return null;
  return [nums[0], nums[nums.length - 1]];
}

function poundRange(lo: number, hi: number): string {
  const f = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
  return lo === hi ? f(lo) : `${f(lo)}–${f(hi)}`;
}

export default function QiPlanPanel() {
  const [status, setStatus] = useState<Status>("idle");
  const [plan, setPlan] = useState<QiPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (poll.current) {
      clearInterval(poll.current);
      poll.current = null;
    }
  };

  const apply = useCallback((data: any) => {
    if (data.status === "done") {
      setPlan(data.content as QiPlan);
      setGeneratedAt(data.generated_at ?? null);
      setStatus("done");
      stopPolling();
    } else if (data.status === "error") {
      setError(data.error ?? "Generation failed.");
      setStatus("error");
      stopPolling();
    } else if (data.status === "queued" || data.status === "running") {
      setStatus(data.status);
    }
  }, []);

  // On load, reattach to whatever the server has: a finished plan, or a job
  // still generating (which keeps running even if you navigated away, and is
  // shared across devices for the same user). If it's in flight, resume polling.
  useEffect(() => {
    fetch("/api/ai/qi-plan")
      .then((r) => r.json())
      .then((d) => {
        apply(d);
        if (d.status === "queued" || d.status === "running") startPolling();
      })
      .catch(() => {});
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    poll.current = setInterval(async () => {
      try {
        const r = await fetch("/api/ai/qi-plan");
        apply(await r.json());
      } catch {
        /* keep polling */
      }
    }, 3000);
  }, [apply]);

  const generate = useCallback(async () => {
    setError(null);
    setStatus("queued");
    try {
      const r = await fetch("/api/ai/qi-plan", { method: "POST" });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error ?? "Could not start generation.");
        setStatus("error");
        return;
      }
      apply(d);
      if (d.status !== "done") startPolling();
    } catch {
      setError("Could not reach the server.");
      setStatus("error");
    }
  }, [apply, startPolling]);

  const busy = status === "queued" || status === "running";

  return (
    <div className="space-y-6">
      {/* Controls — hidden when printing */}
      <div className="flex flex-wrap items-center gap-3 print:hidden" data-no-print>
        <button className="btn" onClick={generate} disabled={busy}>
          {busy ? "Generating…" : plan ? "Regenerate QI plan" : "Generate QI plan"}
        </button>
        {plan && !busy && (
          <button className="btn-ghost" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        )}
        {busy && <span className="text-sm text-slate-500">This takes 10–30 seconds. Analysing all domains…</span>}
        {generatedAt && !busy && (
          <span className="text-sm text-slate-500">Generated {new Date(generatedAt).toLocaleString("en-GB")}</span>
        )}
      </div>

      {error && <div className="card border-red-200 bg-red-50 text-sm text-nhs-red">{error}</div>}

      {busy && !plan && (
        <div className="card flex items-center gap-3 text-slate-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-nhs-blue" />
          Building your plan across all domains…
        </div>
      )}

      {plan && <PlanReport plan={plan} />}
    </div>
  );
}

function PlanReport({ plan }: { plan: QiPlan }) {
  const totalPoints = plan.priority_table.reduce((s, r) => s + (r.points_gap || 0), 0);
  const actionCount = plan.domain_sections.reduce((s, d) => s + d.interventions.length, 0);

  // Total estimated £ opportunity across priorities (parsed from the ranges).
  let vLo = 0, vHi = 0, parsed = 0;
  for (const r of plan.priority_table) {
    const rng = parseRange(r.est_value_range);
    if (rng) { vLo += rng[0]; vHi += rng[1]; parsed++; }
  }

  return (
    <article className="space-y-6">
      {/* At-a-glance metric strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Est. value opportunity" value={parsed ? poundRange(vLo, vHi) : "—"} accent />
        <Metric label="Points recoverable" value={totalPoints.toLocaleString("en-GB")} />
        <Metric label="Priority indicators" value={String(plan.priority_table.length)} />
        <Metric label="Recommended actions" value={String(actionCount)} />
      </div>

      {/* Position summary as a lead callout */}
      <section className="rounded-xl border-l-4 border-nhs-blue bg-white p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-nhs-blue">Position summary</h2>
        <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{plan.position_summary}</p>
      </section>

      {/* Priority indicators */}
      <section>
        <SectionHeading n={1} title="Priority indicators" sub="Ranked by points recoverable — biggest payment opportunity first." />
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="p-3 font-medium">Indicator</th>
                <th className="p-3 font-medium">You → ICB</th>
                <th className="p-3 text-right font-medium">Points</th>
                <th className="p-3 font-medium">Patients</th>
                <th className="p-3 text-right font-medium">Est. value</th>
                <th className="p-3 font-medium">Type</th>
              </tr>
            </thead>
            <tbody>
              {plan.priority_table.map((r, i) => (
                <PriorityRowView key={r.indicator_code} r={r} rank={i + 1} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Domain sections */}
      {plan.domain_sections.map((s, i) => (
        <section key={`${s.domain}-${i}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-l-4 border-nhs-blue px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">{prettyDomain(s.domain)}</h3>
              <div className="flex flex-wrap gap-1">
                {s.indicator_codes.map((c) => (
                  <Link key={c} href={`/i/${c}`} className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 transition hover:bg-nhs-blue/10 hover:text-nhs-blue">{c}</Link>
                ))}
              </div>
            </div>
            <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-slate-600">{s.analysis}</p>
          </div>

          {s.interventions.length > 0 && (
            <div className="space-y-4 bg-slate-50 px-5 py-4">
              {s.interventions.map((iv, idx) => (
                <InterventionCard key={idx} iv={iv} n={idx + 1} />
              ))}
            </div>
          )}

          {s.review_checkpoint && (
            <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
              <span className="font-medium text-slate-700">↻ Review checkpoint:</span> {s.review_checkpoint}
            </p>
          )}
        </section>
      ))}

      {/* Clinical excellence — beyond the points */}
      {plan.clinical_excellence?.length > 0 && (
        <section>
          <SectionHeading title="Clinical excellence — beyond the points" sub="At maximum QOF points, but still behind peers once exception-coded patients are counted back in. No extra points here — this is about patients who may still be missed." />
          <div className="space-y-3">
            {plan.clinical_excellence.map((c, i) => (
              <div key={i} className="rounded-xl border-l-4 border-nhs-green bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-baseline gap-2">
                  <Link href={`/i/${c.indicator_code}`} className="font-mono text-sm font-semibold text-nhs-blue hover:underline">{c.indicator_code}</Link>
                  <span className="text-sm text-slate-500">{c.indicator_name}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{c.finding}</p>
                <p className="mt-2 border-t border-slate-100 pt-2 text-sm text-slate-700">
                  <span className="font-medium text-nhs-green">Action: </span>{c.action}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cross-cutting themes */}
      {plan.cross_cutting_themes.length > 0 && (
        <section>
          <SectionHeading title="Cross-cutting themes" />
          <div className="grid gap-3 sm:grid-cols-2">
            {plan.cross_cutting_themes.map((t, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="font-medium text-slate-900">{t.theme}</p>
                <p className="mt-1 text-sm text-slate-600">{t.evidence}</p>
                <p className="mt-2 border-t border-slate-100 pt-2 text-sm text-slate-600">
                  <span className="font-medium text-nhs-blue">Implication:</span> {t.implication}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Next steps */}
      {plan.next_steps.length > 0 && (
        <section>
          <SectionHeading title="Next steps" />
          <ol className="space-y-2">
            {plan.next_steps.map((n, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-nhs-blue text-xs font-semibold text-white">{i + 1}</span>
                <div>
                  <p className="font-medium text-slate-900">{n.action}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{n.owner_role} · {n.timeframe}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {plan.footer && (
        <footer className="whitespace-pre-line border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-400">{plan.footer}</footer>
      )}
    </article>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${accent ? "border-nhs-blue/30 bg-nhs-blue/5" : "border-slate-200 bg-white"}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${accent ? "text-nhs-blue" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}

function SectionHeading({ n, title, sub }: { n?: number; title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        {n != null && <span className="grid h-6 w-6 place-items-center rounded-md bg-nhs-blue text-xs text-white">{n}</span>}
        {title}
      </h2>
      {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
    </div>
  );
}

function PriorityRowView({ r, rank }: { r: PriorityRow; rank: number }) {
  const gap = GAP_STYLE[r.gap_type] ?? { label: r.gap_type, cls: "bg-slate-100 text-slate-600" };
  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="p-3">
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-slate-400">{rank}</span>
          <Link href={`/i/${r.indicator_code}`} className="font-mono font-medium text-nhs-blue hover:underline">{r.indicator_code}</Link>
        </div>
        <div className="text-slate-500">{r.indicator_name}</div>
      </td>
      <td className="p-3 whitespace-nowrap">
        <span className="font-semibold text-slate-900">{r.current_pct ?? "—"}%</span>
        <span className="text-slate-400"> → </span>
        <span className="text-slate-600">{r.icb_median_pct ?? "—"}%</span>
      </td>
      <td className="p-3 text-right font-semibold">{r.points_gap}</td>
      <td className="p-3 whitespace-nowrap text-slate-600">{r.est_patients_range}</td>
      <td className="p-3 whitespace-nowrap text-right font-semibold text-slate-900">{r.est_value_range}</td>
      <td className="p-3">
        <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${gap.cls}`}>{gap.label}</span>
      </td>
    </tr>
  );
}

function InterventionCard({ iv, n }: { iv: PlanIntervention; n: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex gap-3">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-nhs-green/10 text-xs font-semibold text-nhs-green">{n}</span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900">{iv.contextualised_description}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Chip label="Owner" value={iv.owner_role} />
            <Chip label="Effort" value={iv.effort_estimate} />
            <Chip label="Yield" value={iv.expected_yield} />
            <Chip label="Delivery" value={iv.delivery_mechanism} />
          </div>

          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="text-slate-700">
              <span className="font-medium">Find them (Ardens):</span> {iv.identification.ardens_path}
            </div>
            <div className="mt-1.5 font-mono text-xs leading-relaxed text-slate-500">{iv.identification.search_logic}</div>
          </div>

          {ACCURX[iv.intervention_id] && (
            <div className="mt-3 print:hidden">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Copy-ready Accurx / text message</div>
              <div className="mt-1"><CopyBlock text={ACCURX[iv.intervention_id]} /></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
      <span className="font-medium text-slate-500">{label}:</span> {value}
    </span>
  );
}
