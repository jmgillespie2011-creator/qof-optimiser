// Verified intervention library (§1.4). The model SELECTS and CONTEXTUALISES
// from this list — it must not invent search logic, SNOMED codes, or Ardens menu
// paths. Every entry provides both an Ardens path and buildable search logic,
// because roughly half of practices don't have Ardens. All identification is
// framed as "identify a cohort for clinician review", never directive
// prescribing (§1.5).

export type InterventionCategory =
  | "prescribing_optimisation"
  | "batch_messaging"
  | "invite_recall"
  | "coding_hygiene"
  | "clinic_model";

export type Intervention = {
  id: string;
  indicators: string[]; // QOF indicator codes this applies to
  category: InterventionCategory;
  title: string;
  identification: { ardens_path: string; search_logic: string };
  delivery_mechanism: string;
  owner_role: string;
  effort_estimate: string;
  expected_yield: string;
  guideline_ref?: string;
  // Copy-ready patient-facing message for Accurx/text — present only where the
  // intervention actually contacts patients (not desk/coding/clinician-review ones).
  accurx_message?: string;
};

export const INTERVENTIONS: Intervention[] = [
  {
    id: "statin-cvd-primary",
    indicators: ["CHOL003", "CHOL004"],
    category: "prescribing_optimisation",
    title: "Lipid-lowering therapy in the CVD/CKD/DM cohort",
    identification: {
      ardens_path: "Ardens > Cardiovascular > CVD Prevention > Lipid Lowering Therapy Not Prescribed",
      search_logic:
        "On CVD OR CKD OR diabetes register AND no statin/lipid-lowering issued in last 6 months AND no statin allergy/intolerance code AND no 'declined' code in last 12 months.",
    },
    delivery_mechanism: "AccuRx batch message with patient-facing explainer + booking link, then clinical pharmacist review.",
    owner_role: "Clinical pharmacist",
    effort_estimate: "~2 sessions",
    expected_yield: "25-30% of contacted patients started or reviewed",
    accurx_message:
      "Hi [first name], our records suggest your heart health could benefit from a medication review. Cholesterol-lowering treatment (a statin) lowers your risk of heart attack and stroke. Please book a phone or face-to-face review here: [booking link], or reply if you'd prefer not to. Thanks, [Practice name].",
    guideline_ref: "NICE NG238",
  },
  {
    id: "sglt2-ckd-hf-t2dm",
    indicators: ["DM033", "DM036", "CKD005"],
    category: "prescribing_optimisation",
    title: "SGLT2 inhibitor candidates in CKD / heart failure / type 2 diabetes",
    identification: {
      ardens_path: "Ardens > Diabetes > Medication Optimisation > SGLT2i Candidates",
      search_logic:
        "On type 2 diabetes OR CKD OR heart failure register AND meets eligibility (eGFR in range) AND not currently on an SGLT2 inhibitor AND no contraindication code. Present the list for clinician review against NICE NG28 / NG203 / NG106 — do not auto-initiate.",
    },
    delivery_mechanism: "Pharmacist desk exercise; flag candidates in the clinician's workflow for review at next contact.",
    owner_role: "Clinical pharmacist",
    effort_estimate: "~2 sessions",
    expected_yield: "Cohort identified for review; initiation is a clinician decision",
    guideline_ref: "NICE NG28 / NG203 / NG106",
  },
  {
    id: "acei-arb-proteinuric-ckd",
    indicators: ["CKD005", "DM036"],
    category: "prescribing_optimisation",
    title: "ACE inhibitor / ARB in proteinuric CKD",
    identification: {
      ardens_path: "Ardens > Renal > CKD > ACEi/ARB Not Prescribed with Proteinuria",
      search_logic:
        "On CKD register AND ACR raised (proteinuria coded) AND no ACE inhibitor or ARB issued in last 6 months AND no contraindication/intolerance code. Identify for clinician review.",
    },
    delivery_mechanism: "Pharmacist review list surfaced to the responsible clinician.",
    owner_role: "Clinical pharmacist",
    effort_estimate: "~1 session",
    expected_yield: "Cohort identified for review",
    guideline_ref: "NICE NG203",
  },
  {
    id: "bp-self-report-batch",
    indicators: ["HYP008", "HYP009", "BP002"],
    category: "batch_messaging",
    title: "Self-reported home blood pressure to close the data gap",
    identification: {
      ardens_path: "Ardens > Cardiovascular > Hypertension > BP Not Recorded in 12 Months",
      search_logic:
        "On hypertension register AND no blood pressure recorded in last 12 months AND not coded as housebound/declined. Send batch request for a home reading.",
    },
    delivery_mechanism: "AccuRx Batch / Florey questionnaire requesting a home BP reading; auto-file into the record.",
    owner_role: "Practice administrator / HCA",
    effort_estimate: "~half a session to set up",
    expected_yield: "Cheap way to close data-completeness gaps; typical response 20-35%",
    accurx_message:
      "Hi [first name], we don't have a recent blood pressure reading for you. If you have a home monitor, please take a reading (sit and rest 5 minutes first) and submit it here: [link]. No monitor? Reply and we'll arrange a check. Thank you, [Practice name].",
  },
  {
    id: "smoking-status-batch",
    indicators: ["SMOK002", "SMOK004", "SMOK005"],
    category: "batch_messaging",
    title: "Smoking status refresh and cessation referral",
    identification: {
      ardens_path: "Ardens > Lifestyle > Smoking > Status Not Recorded in 12 Months",
      search_logic:
        "On a relevant disease register AND no smoking status recorded in last 12 months. Batch request status; offer cessation referral to current smokers.",
    },
    delivery_mechanism: "AccuRx Batch message with self-report link + local stop-smoking service referral.",
    owner_role: "Practice administrator",
    effort_estimate: "~half a session",
    expected_yield: "Closes coding gaps; cessation uptake varies",
    accurx_message:
      "Hi [first name], we're updating our records. Could you let us know your current smoking status here: [link]? If you smoke and would like free help to stop, we can refer you to your local stop-smoking service. Thanks, [Practice name].",
    guideline_ref: "NICE NG209",
  },
  {
    id: "cervical-screening-recall",
    indicators: ["CS005", "CS006"],
    category: "invite_recall",
    title: "Cervical screening recall for women overdue a smear",
    identification: {
      ardens_path: "Ardens > Women's Health > Cervical Screening > Overdue Screening",
      search_logic:
        "Female AND in the eligible age band for the indicator (25-49, or 50-64) AND no adequate cervical sample recorded within the screening interval AND no exclusion, deferral or 'ceased' code. Exclude those already invited in the last 3 months.",
    },
    delivery_mechanism:
      "Channel cascade: text with the national booking information first, then letter, then phone for non-responders; offer extended-hours or female-sample-taker slots.",
    owner_role: "Practice administrator / practice nurse",
    effort_estimate: "~1-2 sessions to set up, then ongoing recall",
    expected_yield: "Cascade recall typically recovers 5-15% of the overdue cohort",
    accurx_message:
      "Hi [first name], our records show your NHS cervical screening (smear test) is due. It's a quick test that helps prevent cervical cancer. Please book here: [booking link], or reply if you've had it done elsewhere or would like to talk it through. Thank you, [Practice name].",
    guideline_ref: "NHS Cervical Screening Programme",
  },
  {
    id: "vaccination-cascade",
    indicators: ["VI001", "VI002", "VI003", "VI004"],
    category: "invite_recall",
    title: "Vaccination invite cascade (childhood immunisations, flu, pneumococcal, shingles, RSV)",
    identification: {
      ardens_path: "Ardens > Immunisations > Eligible Not Vaccinated",
      search_logic:
        "Eligible cohort for the vaccination AND not vaccinated this season/course AND no declined/contraindication code. Run a channel cascade for non-responders.",
    },
    delivery_mechanism: "Channel cascade: text first, then letter, then phone for non-responders.",
    owner_role: "Practice administrator / nursing team",
    effort_estimate: "~1-2 sessions per campaign",
    expected_yield: "Non-responder cascade typically recovers a further 5-15%",
    accurx_message:
      "Hi [first name], our records show you may be due an NHS vaccination. It's a free appointment that protects against serious illness. Please book here: [booking link], or reply if you've had it elsewhere or would like more information. Thank you, [Practice name].",
  },
  {
    id: "ld-smi-health-checks",
    indicators: ["MH021", "LD004", "DEP004"],
    category: "invite_recall",
    title: "Learning disability / serious mental illness annual health checks",
    identification: {
      ardens_path: "Ardens > Mental Health > SMI Health Check Due",
      search_logic:
        "On SMI or LD register AND no annual physical health check completed this year AND not declined. Invite with a cascade text → letter → phone.",
    },
    delivery_mechanism: "Structured recall with a longer appointment; cascade for non-responders.",
    owner_role: "Practice nurse / HCA",
    effort_estimate: "~2 sessions of clinic time",
    expected_yield: "Recovers under-reviewed cohort; supports several MH indicators at once",
    accurx_message:
      "Hi [first name], you're due your free annual health check. It's a longer appointment to check your physical health and wellbeing, and we can make adjustments to help. Please book here: [booking link], or reply and we'll help you arrange it. Thank you, [Practice name].",
  },
  {
    id: "annual-review-recall",
    indicators: ["DM014", "COPD015", "AST011", "AST007", "AF006"],
    category: "invite_recall",
    title: "Structured annual review recall for long-term conditions",
    identification: {
      ardens_path: "Ardens > Long Term Conditions > Annual Review Overdue",
      search_logic:
        "On the relevant disease register AND annual review not completed this QOF year AND not declined/housebound-only. Invite by birthday-month recall.",
    },
    delivery_mechanism: "Birthday-month recall via text → letter → phone; book into a review clinic template.",
    owner_role: "Practice nurse / HCA",
    effort_estimate: "Ongoing; ~1 session/week of clinic capacity",
    expected_yield: "Steady catch-up on overdue reviews across multiple indicators",
    accurx_message:
      "Hi [first name], you're due your annual review for your long-term condition. This helps us keep your treatment right for you. Please book here: [booking link], or reply if you need a different time or support to attend. Thanks, [Practice name].",
  },
  {
    id: "coding-template-review",
    indicators: [],
    category: "coding_hygiene",
    title: "Template and exception-coding review",
    identification: {
      ardens_path: "Ardens > QOF > Exception Reporting Review",
      search_logic:
        "Where an indicator's exception rate is a significant outlier vs ICB, review the template and coding rather than assuming a clinical gap. Check for miscoded declines, missing 'unsuitable' codes, and template fields that don't map to the indicator.",
    },
    delivery_mechanism: "Desk review of the indicator template and a sample of exception-coded patients.",
    owner_role: "Practice manager / QOF lead",
    effort_estimate: "~1 session per flagged indicator",
    expected_yield: "Often the real fix where exception rates are high",
  },
  {
    id: "hca-bp-bloods-clinic",
    indicators: ["HYP008", "DM014", "CKD005"],
    category: "clinic_model",
    title: "HCA-led BP and bloods catch-up clinic",
    identification: {
      ardens_path: "Ardens > Long Term Conditions > Bloods/Obs Overdue",
      search_logic:
        "On a disease register AND required bloods or observations overdue this year. Batch into HCA-led sessions.",
    },
    delivery_mechanism: "Dedicated HCA clinic blocks (including Saturday catch-up) for BP, bloods and observations.",
    owner_role: "HCA, supervised by practice nurse",
    effort_estimate: "~1 clinic session/week",
    expected_yield: "Clears backlog of overdue measurements feeding several indicators",
    accurx_message:
      "Hi [first name], you're due a routine blood pressure and blood test. We're running extra clinic sessions to make this easy to attend. Please book a slot here: [booking link], or reply if none suit and we'll help. Thank you, [Practice name].",
  },
  {
    id: "pharmacist-review-block",
    indicators: ["CHOL003", "DM036", "CKD005", "AF006"],
    category: "clinic_model",
    title: "Protected clinical pharmacist review block",
    identification: {
      ardens_path: "Ardens > Medicines Optimisation > Structured Medication Review Due",
      search_logic:
        "Patients on the register with a prescribing optimisation opportunity or an overdue structured medication review. Prioritise by number of eligible indicators per patient.",
    },
    delivery_mechanism: "Weekly protected pharmacist block working through the prioritised list.",
    owner_role: "Clinical pharmacist",
    effort_estimate: "~1 session/week",
    expected_yield: "Highest value per unit effort — often no GP appointment needed",
  },
];

const byId = new Map(INTERVENTIONS.map((i) => [i.id, i]));

export function getIntervention(id: string): Intervention | undefined {
  return byId.get(id);
}

export function interventionExists(id: string): boolean {
  return byId.has(id);
}

// Filter to entries relevant to a set of indicator codes with gaps. Coding-hygiene
// entries (empty `indicators`) are always eligible — they apply wherever exception
// rates are the problem.
export function filterInterventions(indicatorCodes: string[]): Intervention[] {
  const wanted = new Set(indicatorCodes);
  return INTERVENTIONS.filter((i) => i.indicators.length === 0 || i.indicators.some((c) => wanted.has(c)));
}
