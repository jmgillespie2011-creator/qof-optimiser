import { interventionExists } from "@/lib/ai/interventions";
import type { QiPlanInput } from "./input";
import type { QiPlan } from "./types";

export type ValidationResult = { ok: true; plan: QiPlan } | { ok: false; errors: string[] };

// Directive prescribing language is rejected outright (§1.5, §8).
const DIRECTIVE_PATTERNS: RegExp[] = [
  /should be (prescribed|started|initiated|commenced|switched)/i,
  /start (these |the )?patients? on/i,
  /\binitiate treatment\b/i,
  /\bmust be prescribed\b/i,
  /\bcommence (these |the )?patients? on\b/i,
  /\bput (these |the )?patients? on\b/i,
];

function allStrings(obj: unknown, out: string[] = []): string[] {
  if (typeof obj === "string") out.push(obj);
  else if (Array.isArray(obj)) obj.forEach((v) => allStrings(v, out));
  else if (obj && typeof obj === "object") Object.values(obj).forEach((v) => allStrings(v, out));
  return out;
}

// §0.5 / §8: schema-shape, verify numbers against source data, confirm every
// intervention id exists, reject directive prescribing language.
export function validateQiPlan(raw: unknown, input: QiPlanInput): ValidationResult {
  const errors: string[] = [];
  const plan = raw as QiPlan;

  if (!plan || typeof plan !== "object") return { ok: false, errors: ["Output is not an object."] };
  if (typeof plan.position_summary !== "string") errors.push("Missing position_summary.");
  if (!Array.isArray(plan.priority_table)) errors.push("Missing priority_table.");
  if (!Array.isArray(plan.domain_sections)) errors.push("Missing domain_sections.");

  const inputByCode = new Map(input.priority_indicators.map((p) => [p.indicator_code, p]));

  // Every number in the priority table must match the pre-computed input (§0.5).
  for (const row of plan.priority_table ?? []) {
    const src = inputByCode.get(row.indicator_code);
    if (!src) {
      errors.push(`priority_table references unknown indicator ${row.indicator_code}.`);
      continue;
    }
    if (row.est_patients_range !== src.est_patients_range)
      errors.push(`${row.indicator_code}: est_patients_range "${row.est_patients_range}" not from input ("${src.est_patients_range}").`);
    if (row.est_value_range !== src.est_value_range)
      errors.push(`${row.indicator_code}: est_value_range "${row.est_value_range}" not from input ("${src.est_value_range}").`);
    if (src.current_pct != null && row.current_pct !== src.current_pct)
      errors.push(`${row.indicator_code}: current_pct ${row.current_pct} does not match input ${src.current_pct}.`);
    if (src.icb_median_pct != null && row.icb_median_pct !== src.icb_median_pct)
      errors.push(`${row.indicator_code}: icb_median_pct ${row.icb_median_pct} does not match input ${src.icb_median_pct}.`);
    if (Math.abs((row.points_gap ?? 0) - src.points_recoverable) > 0.11)
      errors.push(`${row.indicator_code}: points_gap ${row.points_gap} does not match points recoverable ${src.points_recoverable}.`);
  }

  // Every referenced intervention id must exist in the library (§1.4).
  for (const section of plan.domain_sections ?? []) {
    for (const iv of section.interventions ?? []) {
      if (!interventionExists(iv.intervention_id))
        errors.push(`Unknown intervention_id "${iv.intervention_id}" — not in the verified library.`);
    }
  }

  // No directive prescribing language anywhere (§1.5).
  for (const s of allStrings(plan)) {
    for (const re of DIRECTIVE_PATTERNS) {
      if (re.test(s)) {
        errors.push(`Directive prescribing language detected: "${s.trim().slice(0, 120)}".`);
        break;
      }
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, plan };
}
