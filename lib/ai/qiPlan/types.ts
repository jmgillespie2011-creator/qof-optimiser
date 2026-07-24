// Output structure for a QI plan (§1.3) plus the JSON Schema passed to the model
// for structured outputs. Schema rules: every object sets additionalProperties
// false and lists all properties in `required`; nullable fields use a type array.

export type GapType = "achievement" | "exception_coding" | "prevalence_coding";

export type PriorityRow = {
  indicator_code: string;
  indicator_name: string;
  current_pct: number | null;
  icb_median_pct: number | null;
  points_gap: number;
  est_patients_range: string;
  est_value_range: string;
  gap_type: GapType;
};

export type PlanIntervention = {
  intervention_id: string;
  contextualised_description: string;
  identification: { ardens_path: string; search_logic: string };
  delivery_mechanism: string;
  owner_role: string;
  effort_estimate: string;
  expected_yield: string;
};

export type DomainSection = {
  domain: string;
  indicator_codes: string[];
  analysis: string;
  interventions: PlanIntervention[];
  review_checkpoint: string;
};

// Indicators at maximum QOF points where the practice still trails peers once
// exception-coded patients are counted back in — clinical excellence, not payment.
export type ClinicalExcellenceItem = {
  indicator_code: string;
  indicator_name: string;
  finding: string;
  action: string;
};

export type QiPlan = {
  position_summary: string;
  priority_table: PriorityRow[];
  domain_sections: DomainSection[];
  clinical_excellence: ClinicalExcellenceItem[];
  cross_cutting_themes: { theme: string; evidence: string; implication: string }[];
  next_steps: { action: string; owner_role: string; timeframe: string }[];
  footer?: string; // added by application code after generation (§0.6)
};

const nullableNumber = { type: ["number", "null"] };

export const QI_PLAN_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["position_summary", "priority_table", "domain_sections", "clinical_excellence", "cross_cutting_themes", "next_steps"],
  properties: {
    position_summary: { type: "string" },
    priority_table: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["indicator_code", "indicator_name", "current_pct", "icb_median_pct", "points_gap", "est_patients_range", "est_value_range", "gap_type"],
        properties: {
          indicator_code: { type: "string" },
          indicator_name: { type: "string" },
          current_pct: nullableNumber,
          icb_median_pct: nullableNumber,
          points_gap: { type: "number" },
          est_patients_range: { type: "string" },
          est_value_range: { type: "string" },
          gap_type: { type: "string", enum: ["achievement", "exception_coding", "prevalence_coding"] },
        },
      },
    },
    domain_sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["domain", "indicator_codes", "analysis", "interventions", "review_checkpoint"],
        properties: {
          domain: { type: "string" },
          indicator_codes: { type: "array", items: { type: "string" } },
          analysis: { type: "string" },
          interventions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["intervention_id", "contextualised_description", "identification", "delivery_mechanism", "owner_role", "effort_estimate", "expected_yield"],
              properties: {
                intervention_id: { type: "string" },
                contextualised_description: { type: "string" },
                identification: {
                  type: "object",
                  additionalProperties: false,
                  required: ["ardens_path", "search_logic"],
                  properties: { ardens_path: { type: "string" }, search_logic: { type: "string" } },
                },
                delivery_mechanism: { type: "string" },
                owner_role: { type: "string" },
                effort_estimate: { type: "string" },
                expected_yield: { type: "string" },
              },
            },
          },
          review_checkpoint: { type: "string" },
        },
      },
    },
    clinical_excellence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["indicator_code", "indicator_name", "finding", "action"],
        properties: {
          indicator_code: { type: "string" },
          indicator_name: { type: "string" },
          finding: { type: "string" },
          action: { type: "string" },
        },
      },
    },
    cross_cutting_themes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["theme", "evidence", "implication"],
        properties: { theme: { type: "string" }, evidence: { type: "string" }, implication: { type: "string" } },
      },
    },
    next_steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "owner_role", "timeframe"],
        properties: { action: { type: "string" }, owner_role: { type: "string" }, timeframe: { type: "string" } },
      },
    },
  },
};
