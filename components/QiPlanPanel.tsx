"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { QiPlan } from "@/lib/ai/qiPlan/types";

type Status = "idle" | "queued" | "running" | "done" | "error";

const GAP_LABEL: Record<string, string> = {
  achievement: "Achievement gap",
  exception_coding: "Exception / coding",
  prevalence_coding: "Prevalence / coding",
};

// Turn a machine domain key ("public_health") into a heading ("Public health").
function prettyDomain(d: string): string {
  const s = d.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
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

  // Show an existing cached plan on load, if any.
  useEffect(() => {
    fetch("/api/ai/qi-plan")
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "done") apply(d);
      })
      .catch(() => {});
    return stopPolling;
  }, [apply]);

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
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" onClick={generate} disabled={busy}>
          {busy ? "Generating…" : plan ? "Regenerate QI plan" : "Generate QI plan"}
        </button>
        {busy && <span className="text-sm text-slate-500">This takes 10–30 seconds. Analysing all domains…</span>}
        {generatedAt && !busy && (
          <span className="text-sm text-slate-500">Generated {new Date(generatedAt).toLocaleString("en-GB")}</span>
        )}
      </div>

      {error && (
        <div className="card border-red-200 bg-red-50 text-sm text-nhs-red">{error}</div>
      )}

      {plan && (
        <article className="space-y-8">
          <section className="card">
            <h2 className="text-lg font-semibold">Position summary</h2>
            <p className="mt-2 whitespace-pre-line text-slate-700">{plan.position_summary}</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Priority indicators</h2>
            <p className="mb-3 text-sm text-slate-500">Ranked by points recoverable — biggest payment opportunity first.</p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="p-3">Indicator</th>
                    <th className="p-3">You</th>
                    <th className="p-3">ICB</th>
                    <th className="p-3">Points</th>
                    <th className="p-3">Patients</th>
                    <th className="p-3">Value</th>
                    <th className="p-3">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.priority_table.map((r) => (
                    <tr key={r.indicator_code} className="border-t border-slate-100 align-top">
                      <td className="p-3">
                        <div className="font-medium text-nhs-blue">{r.indicator_code}</div>
                        <div className="text-slate-500">{r.indicator_name}</div>
                      </td>
                      <td className="p-3">{r.current_pct ?? "—"}%</td>
                      <td className="p-3">{r.icb_median_pct ?? "—"}%</td>
                      <td className="p-3 font-semibold">{r.points_gap}</td>
                      <td className="p-3">{r.est_patients_range}</td>
                      <td className="p-3 font-semibold">{r.est_value_range}</td>
                      <td className="p-3 text-slate-600">{GAP_LABEL[r.gap_type] ?? r.gap_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {plan.domain_sections.map((s) => (
            <section key={s.domain} className="card">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-base font-semibold">{prettyDomain(s.domain)}</h3>
                <span className="text-xs text-slate-400">{s.indicator_codes.join(", ")}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-slate-700">{s.analysis}</p>
              <div className="mt-4 space-y-4">
                {s.interventions.map((iv, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="font-medium">{iv.contextualised_description}</p>
                    <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-2">
                      <div><dt className="inline font-medium">Ardens: </dt><dd className="inline">{iv.identification.ardens_path}</dd></div>
                      <div><dt className="inline font-medium">Owner: </dt><dd className="inline">{iv.owner_role}</dd></div>
                      <div className="sm:col-span-2"><dt className="inline font-medium">Search: </dt><dd className="inline">{iv.identification.search_logic}</dd></div>
                      <div><dt className="inline font-medium">Delivery: </dt><dd className="inline">{iv.delivery_mechanism}</dd></div>
                      <div><dt className="inline font-medium">Effort: </dt><dd className="inline">{iv.effort_estimate}</dd></div>
                      <div><dt className="inline font-medium">Expected yield: </dt><dd className="inline">{iv.expected_yield}</dd></div>
                    </dl>
                  </div>
                ))}
              </div>
              {s.review_checkpoint && (
                <p className="mt-3 text-sm text-slate-500"><span className="font-medium">Review checkpoint:</span> {s.review_checkpoint}</p>
              )}
            </section>
          ))}

          {plan.cross_cutting_themes.length > 0 && (
            <section className="card">
              <h2 className="text-lg font-semibold">Cross-cutting themes</h2>
              <ul className="mt-2 space-y-3">
                {plan.cross_cutting_themes.map((t, i) => (
                  <li key={i}>
                    <p className="font-medium">{t.theme}</p>
                    <p className="text-sm text-slate-600">{t.evidence}</p>
                    <p className="text-sm text-slate-600"><span className="font-medium">Implication:</span> {t.implication}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plan.next_steps.length > 0 && (
            <section className="card">
              <h2 className="text-lg font-semibold">Next steps</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {plan.next_steps.map((n, i) => (
                  <li key={i} className="flex flex-wrap gap-x-2">
                    <span className="font-medium">{n.action}</span>
                    <span className="text-slate-500">— {n.owner_role}, {n.timeframe}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plan.footer && (
            <footer className="whitespace-pre-line border-t border-slate-200 pt-4 text-xs text-slate-400">{plan.footer}</footer>
          )}
        </article>
      )}
    </div>
  );
}
