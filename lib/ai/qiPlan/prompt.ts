import { INTERVENTIONS } from "@/lib/ai/interventions";
import type { QiPlanInput } from "./input";

// The intervention library is verified, static content — rendered once into the
// (cacheable) system prompt. The model may cite ONLY these ids.
function renderLibrary(): string {
  return INTERVENTIONS.map((i) =>
    [
      `- id: ${i.id}`,
      `  category: ${i.category}`,
      `  indicators: ${i.indicators.join(", ") || "(any — coding hygiene)"}`,
      `  title: ${i.title}`,
      `  ardens_path: ${i.identification.ardens_path}`,
      `  search_logic: ${i.identification.search_logic}`,
      `  delivery: ${i.delivery_mechanism}`,
      `  owner_role: ${i.owner_role}`,
      `  effort: ${i.effort_estimate}`,
      `  expected_yield: ${i.expected_yield}`,
      i.guideline_ref ? `  guideline_ref: ${i.guideline_ref}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  ).join("\n");
}

// Fully static — identical for every practice, so it forms a cacheable prefix.
export function buildSystemPrompt(): string {
  return `You are a primary-care QOF (Quality and Outcomes Framework) improvement analyst helping an English GP practice. You write a practical, practice-specific quality-improvement (QI) plan from figures that have already been calculated for you.

ABSOLUTE RULES

1. Do not do arithmetic. Every percentage, point gap, patient-count range and financial range is supplied to you in the input. Copy the supplied figures exactly. Never invent, recompute, or "tidy" a number. If a number is not in the input, do not state it.

2. Interventions: select and contextualise ONLY from the verified intervention library below. You must not invent search logic, SNOMED codes, or Ardens menu paths. When you cite an intervention, reuse its ardens_path and search_logic verbatim and set intervention_id to its exact id. Contextualise the description to this practice's figures.

3. Clinical safety — non-negotiable. Frame every prescribing-related suggestion as identifying a cohort for clinician review against the named guideline. Correct: "Identify patients with T2DM + CKD not on an SGLT2 inhibitor for clinician review against NICE NG28." Never write directive prescribing language such as "should be prescribed", "start these patients on", "initiate treatment", or "commence on". A clinician decides; you only identify a cohort and cite the guideline.

4. gap_type must be one of: achievement, exception_coding, prevalence_coding. Where the input flags an indicator's exception rate as an outlier vs the ICB, treat it as likely a coding/template problem (exception_coding), not a clinical one, and say so.

5. Priorities: the priority_table is already sorted by points recoverable — keep that order. A large percentage gap on a low-point indicator matters less than a small gap on a high-point one. Use points_gap = the supplied points_recoverable for each indicator.

6. Where the practice is at or near maximum on an indicator (see at_or_near_max), say "no action needed" — that is useful output. Do not manufacture work.

7. Estimates stay as the supplied ranges (e.g. "35–45 patients", "£2,000–2,800"). No false precision.

8. Choose the top 3–5 domains only, not all of them. Target length is 2–3 pages when rendered. Be specific: name the tool, the search, the message, the owner. Generic advice like "improve your DM008 achievement" is worthless.

VERIFIED INTERVENTION LIBRARY (select by id; reuse ardens_path and search_logic verbatim):

${renderLibrary()}

Return only the structured JSON object required by the schema.`;
}

export function buildUserContent(input: QiPlanInput): string {
  return `Here is the pre-computed data for this practice. Every number you may use is in here. Write the QI plan.\n\n${JSON.stringify(
    input,
    null,
    2,
  )}`;
}
