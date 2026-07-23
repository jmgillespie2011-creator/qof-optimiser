import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CopyBlock from "@/components/CopyBlock";
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string,string> = {
  florey_questionnaire: "Accurx Custom Florey (questionnaire)",
  batch_sms: "Accurx Batch SMS",
  vba_script: "Very Brief Advice script",
};

export default async function QIPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: qi } = await supabase.from("qi_suggestion").select("*").eq("id", slug).single();
  if (!qi) notFound();
  const { data: ind } = await supabase.from("qof_indicator").select("*").eq("indicator_code", qi.indicator_code).single();
  let tmpl: any = null;
  if (qi.accurx_template_id) {
    const { data } = await supabase.from("accurx_template").select("*").eq("id", qi.accurx_template_id).single();
    tmpl = data;
  }
  return (
    <div className="max-w-3xl space-y-6">
      <Link href={`/domains/${ind?.domain}/${qi.indicator_code}`} className="text-sm text-nhs-blue">← {qi.indicator_code} {ind?.title}</Link>
      <div>
        <h1 className="text-2xl font-bold">{qi.title}</h1>
        <p className="mt-2 text-slate-600">{qi.rationale}</p>
      </div>

      {tmpl ? (
        <>
          <div className="card">
            <div className="mb-1 text-xs font-medium uppercase text-slate-400">{KIND_LABEL[tmpl.kind] ?? tmpl.kind}</div>
            <h2 className="font-semibold">{tmpl.title}</h2>
            <p className="mt-1 text-sm text-slate-600">Copy this into Accurx as a Custom Questionnaire or Batch message, then select the cohort described below.</p>
            <div className="mt-4"><CopyBlock text={tmpl.body_markdown} /></div>
          </div>
          {tmpl.clinical_notes && (
            <div className="card bg-amber-50">
              <h3 className="font-semibold">How to deploy & code</h3>
              <p className="mt-1 text-sm text-slate-700">{tmpl.clinical_notes}</p>
            </div>
          )}
          <a className="btn-ghost" href="https://web.accurx.com" target="_blank" rel="noreferrer">Open Accurx web →</a>
        </>
      ) : (
        <div className="card"><p className="text-slate-600">This action is a coding/process review — no patient message required. See rationale above.</p></div>
      )}

      <p className="text-xs text-slate-500">This tool provides content and targeting only. All messaging and patient data stay inside your practice's own Accurx account.</p>
    </div>
  );
}
